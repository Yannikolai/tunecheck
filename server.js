require('dotenv').config();
const express = require('express');
const axios = require('axios');
const querystring = require('querystring');

const app = express();
const port = process.env.PORT || 3000;

// Enable CORS for all routes
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
  });

// Replace these with your Spotify Client ID and Secret from the .env file
const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI || 'http://localhost:3000/callback';
const scopes = ['user-read-private', 'user-read-email', 'user-top-read'].join(' ');

console.log(CLIENT_ID)

// Temporarily store access token - Consider using sessions or a more secure method in production
let accessToken;

// Serve static files from the 'public' folder
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/tunecheck.html');
});

app.get('/login', (req, res) => {
    const SCOPES = 'user-read-private user-read-email user-top-read'; // Include additional scopes as needed
    res.redirect(`https://accounts.spotify.com/authorize?${querystring.stringify({
        response_type: 'code',
        client_id: CLIENT_ID,
        scope: SCOPES,
        redirect_uri: REDIRECT_URI,
        show_dialog: true, // Force the dialog to show on login
    })}`);
});


app.get('/callback', async (req, res) => {
    const code = req.query.code || null;
    const error = req.query.error || null;
 
    // Check if there was an error in the query parameters (e.g., user cancelled the login)
    if (error) {
        console.error('Login was cancelled or failed', error);
        return res.redirect('/'); // Redirect the user back to the initial page
    }
 
    try {
        const tokenResponse = await axios({
            method: 'post',
            url: 'https://accounts.spotify.com/api/token',
            data: querystring.stringify({
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: REDIRECT_URI,
            }),
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')}`,
            },
        });
 
        accessToken = tokenResponse.data.access_token; // Store access token
 
        // Redirect to home page after login
        res.redirect('/');
 
    } catch (error) {
        console.error('Access Token Error', error.message);
        res.send('Authentication failed');
    }
});

app.get('/api/top-artists', async (req, res) => {
    if (!accessToken) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
        // Fetch top artists
        const artistResponse = await axios.get('https://api.spotify.com/v1/me/top/artists?limit=5', {
            headers: { 'Authorization': `Bearer ${accessToken}` },
        });

        // Extract artist names and IDs
        const artists = artistResponse.data.items.map(artist => {
            return {
                name: artist.name,
                id: artist.id
            };
        });

        // Fetch genres for these artists (consider batching if >50 artists)
        const genreDict = await getArtistGenreFromArtists(artists.map(artist => artist.id));

        // Return both artists and genres
        res.json({
            artists: artists,
            genres: genreDict,
        });
    } catch (error) {
        console.error("Error:", error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Failed to fetch data', details: error.response ? error.response.data : error.message });
    }
});


// Helper function to aggregate genres
function addToGenreDict(genres, genreDict) {
    genres.forEach(genre => {
      genreDict[genre] = (genreDict[genre] || 0) + 1;
    });
    return genreDict;
  }
  
  // Fetches genres for a batch of artist IDs
  async function getArtistGenreFromArtists(artistBatch) {
    try {
      const response = await axios.get(`https://api.spotify.com/v1/artists?ids=${artistBatch.join(',')}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      let genreDict = {};
      response.data.artists.forEach(artist => {
        genreDict = addToGenreDict(artist.genres, genreDict);
      });
      return genreDict;
    } catch (error) {
      console.error("Error fetching artist genres:", error.response ? error.response.data : error.message);
      throw error;
    }
  }  

//////////////////////////////////////////////////////////////////////////////////////////////
// API key handling

  app.get('/api/user-location', async (req, res) => {
    const LOCATION_API_KEY = process.env.LOCATION_API_KEY;
    const url = `https://ipgeolocation.abstractapi.com/v1/?api_key=${LOCATION_API_KEY}`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        res.json(data); // Send the geolocation data back to the client
    } catch (error) {
        console.error('Error fetching geolocation:', error);
        res.status(500).json({ error: 'Failed to fetch geolocation' });
    }
});

//////////////////////////////////////////////////////////////////////////////////////////////
// Fetches events from Ticketmaster based on a genre and location
const TICKETMASTER_API_KEYS = [process.env.TICKETMASTER_API_KEY1, process.env.TICKETMASTER_API_KEY2, process.env.TICKETMASTER_API_KEY3];
let currentApiKeyIndex = 0;
let rateLimitReached = false;
function getNextTicketmasterApiKey() {
    const key = TICKETMASTER_API_KEYS[currentApiKeyIndex];
    currentApiKeyIndex = (currentApiKeyIndex + 1) % TICKETMASTER_API_KEYS.length; // Rotate the index
    return key;
}

async function fetchEventsByGenre(genre, cityInput = userLocation) {
    const startDate = new Date();
    const endDate = new Date();
    const size = 2; // Limit to 2 events to manage load
    endDate.setMonth(endDate.getMonth() + 6); // Set the end date to 6 months from today

    const startDateISO = startDate.toISOString().split('T')[0];
    const endDateISO = endDate.toISOString().split('T')[0];

    const apiKey = getNextTicketmasterApiKey(); // Use the rotated API key
    const url = `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${apiKey}&keyword=${genre}&city=${cityInput}&startDateTime=${startDateISO}T00:00:00Z&endDateTime=${endDateISO}T23:59:59Z&size=${size}`;

    if (rateLimitReached) {
        console.log("Rate limit reached, stopping further API calls");
        return [];
    }

    try {
        const response = await axios.get(url);
        if (response.data._embedded && response.data._embedded.events) {
            let events = response.data._embedded.events.map(event => ({
                name: event.name.split(' | ')[0], // Only keep the part before " | "
                url: event.url,
                startDate: event.dates.start.localDate,
                venue: event._embedded.venues[0].address.line1,
                imageUrl: event.images[0].url,
            }));

            return events;
        } else {
            return [];
        }
    } catch (error) {
        if (error.response && error.response.status === 429) {
            console.error('Rate limit error from Ticketmaster:', error);
            rateLimitReached = true; // Set the flag to stop further calls
        } else {
            console.error('Error fetching events from Ticketmaster:', error);
        }
        return [];
    }
}

// Function to search for an artist by name and return their Spotify ID
async function fetchSpotifyArtistId(artistName) {
    if (!accessToken) {
      console.error('Spotify access token is not available.');
      return null;
    }
  
    const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(artistName)}&type=artist&limit=50`; // Increase limit to ensure more results for accurate matching
    try {
      const response = await axios.get(url, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      const artists = response.data.artists.items;
      if (artists.length > 0) {
        // Improved matching: Look for an exact match in the artist's name
        const exactMatch = artists.find(artist => artist.name.toLowerCase() === artistName.toLowerCase());
        if (exactMatch) {
          return exactMatch.id; // Return the ID of the exactly matched artist
        } else {
          console.warn(`Exact match not found for "${artistName}". Consider manual verification.`);
          return null;
        }
      } else {
        console.warn(`No artist found for "${artistName}".`);
        return null;
      }
    } catch (error) {
      console.error('Error fetching Spotify artist ID:', error);
      return null;
    }
}


//////////////////////////////////////////////////////////////////////////
// Retrieves and ranks the top 5 music genres from a user's Spotify top artists, based on listening history.
async function fetchTopGenresFromSpotify(accessToken) {
    if (!accessToken) {
        throw new Error('Not authenticated');
    }
    try {
        const topArtistsResponse = await axios.get('https://api.spotify.com/v1/me/top/artists', {
            headers: { 'Authorization': `Bearer ${accessToken}` },
        });
        const genres = topArtistsResponse.data.items.flatMap(artist => artist.genres);
        const genreFrequency = genres.reduce((acc, genre) => {
            acc[genre] = (acc[genre] || 0) + 1;
            return acc;
        }, {});
        let sortedGenres = Object.entries(genreFrequency)
            .sort((a, b) => b[1] - a[1])
            .map(item => item[0]);

        return sortedGenres.slice(0, 4); // Return only the top 4 genres
    } catch (error) {
        console.error("Error fetching top genres from Spotify:", error.message);
        throw error;
    }
}


//////////////////////////////////////////////////////////////////////////////////////////
// Serves the top 5 music genres of a Spotify user through an Express endpoint, handling authentication errors.
app.get('/api/top-genres', async (req, res) => {
    try {
        const sortedGenres = await fetchTopGenresFromSpotify(accessToken);
        res.json(sortedGenres);
    } catch (error) {
        res.status(error.message === 'Not authenticated' ? 401 : 500).json({ error: error.message });
    }
});


///////////////////////////////////////////////////////////////////////////////////////////
// Handle Event duplicates
function deduplicateEvents(events) {
    const uniqueEvents = [];
    const eventIdentifiers = new Set(); // To track unique identifiers

    events.forEach(event => {
        // Assuming `name` and `startDate` combination is unique for each event
        const eventId = `${event.name}-${event.startDate}`;

        if (!eventIdentifiers.has(eventId)) {
            uniqueEvents.push(event);
            eventIdentifiers.add(eventId);
        }
    });

    return uniqueEvents;
}

//////////////////////////////////////////////////////////////////////////////////////////
// Delay function:
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

//////////////////////////////////////////////////////////////////////////////////////////
// Serves a list of events based on the user's top genres, through an Express endpoint.
app.get('/api/events', async (req, res) => {
    try {
        const userLocation = req.query.location;
        const genres = await fetchTopGenresFromSpotify(accessToken);
        const eventsPromises = genres.map(async genre => {await delay(1000); return fetchEventsByGenre(genre, userLocation);});
        let eventsArrays = await Promise.all(eventsPromises);
        let allEvents = [].concat(...eventsArrays);
        let uniqueEvents = deduplicateEvents(allEvents);

        // Fetch Spotify ID for each event artist and add to event object
        const eventsWithSpotifyIds = await Promise.all(uniqueEvents.map(async event => {
            const spotifyId = await fetchSpotifyArtistId(event.name);
            return { ...event, spotifyId }; // Append Spotify ID to the event object
        }));

        res.json(eventsWithSpotifyIds);
    } catch (error) {
        console.error('Error fetching events for genres:', error);
        res.status(500).json({ error: 'Failed to fetch events' });
    }
});



//////////////////////////////////////////////////////////////////////////////////////////
// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

app.get('/logout', (req, res) => {
    // Remove or invalidate the stored access token
    accessToken = null; // For demonstration, resetting the token. Use a more secure method for production.

    // Redirect to home page or send a response
    res.redirect('/');
});


// Server-side: Check login status endpoint
app.get('/api/login-status', (req, res) => {
    res.json({ loggedIn: !!accessToken });
});


app.get('/api/profile', async (req, res) => {
    if (!accessToken) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
        const profileResponse = await axios.get('https://api.spotify.com/v1/me', {
            headers: { 'Authorization': `Bearer ${accessToken}` },
        });

        // Send back the user's profile data
        res.json(profileResponse.data);
    } catch (error) {
        console.error('Error fetching user profile:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Failed to fetch user profile', details: error.response ? error.response.data : error.message });
    }
});

