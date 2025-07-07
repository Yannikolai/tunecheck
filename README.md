[![Review Assignment Due Date](https://classroom.github.com/assets/deadline-readme-button-24ddc0f5d75046c5622901739e7c5dd533143b0c8e959d652212380cedb1ea36.svg)](https://classroom.github.com/a/kKIX5B90)
[![Open in Visual Studio Code](https://classroom.github.com/assets/open-in-vscode-718a45dd9cf7e7f842a935f5ebbe5719a5e09af4491e668f4dbf3b35d5cca122.svg)](https://classroom.github.com/online_ide?assignment_repo_id=14033219&assignment_repo_type=AssignmentRepo)

# TuneCheck

**Creators:**

- **Veit Nelson Paul Handschuch** (ID: 52856)
- **Matilde Pesce** (ID: 53258)
- **Yannick Nikolai Frettlöhr** (ID: 57926)
- **Gábor Otott-Kovács** (ID: 59760)

## Overview

Tunecheck is a project developed as part of a university course at the Nova School of Business and Economics. Tunecheck provides information on concerts based on the users music taste and location.

## Setup

1. Install Node.js.
2. Navigate into the project folder.
3. Install required dependencies: `npm install`.
4. Run `npm audit fix --force` if necessary.
5. Add a `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` to the file `.env`, which can be obtained from the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).
6. Add `TICKETMASTER_API_KEY`-s to the file `.env`, which can be obtained from [Ticketmaster](https://developer.ticketmaster.com/)
7. Add `LOCATION_API_KEY` to the file `.env`, which can be obtained from [Abstracktapi](https://app.abstractapi.com/users/signup?target=/api/ip-geolocation/pricing/select)
   
## Getting Started

1. Navigate into the project folder.
2. Start a local web server with: `node server.js`.
3. Open the link [http://localhost:3000/](http://localhost:3000/) in your browser.

## Project File Structure

- `package.json` -> a list of all dependencies that need to be installed by npm
- `README.md` -> general information on the project
- `Public` -> contains folders and files necessary for the application
  - `js` -> a folder containing the main javascript file
    - `main.js` -> main file of functionalities
  - `css` -> a folder containing style elements
    - `hero.avif` -> picture used as a background in the hero section
    - `tunecheck.css` -> CSS file for styling the website
  - `tunecheck.html` -> general layout of the webpage
- `server.js` -> code for communicating with the different api-s
- `node_modules` -> this folder includes all the packages installed by npm (do not change)
- `package-lock.json` -> (do not change)
- `.env` -> file containing api keys and ID-s

## API documentation

Spotify API Documentation: https://developer.spotify.com/documentation/web-api <br />
Ticketmaster API Documentation https://developer.ticketmaster.com/products-and-docs/ <br />
Location API Documentation https://docs.abstractapi.com/ip-geolocation <br /># tunecheck
# tunecheck
