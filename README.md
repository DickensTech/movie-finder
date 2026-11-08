# Movie Finder

Movie Finder is a React app for discovering and searching movies with TMDB. Browse movies by genre, sort and filter by year, save favorites to **My list**, and explore movie details, trailers, and similar recommendations. The app also includes a light/dark theme toggle and animated loading states.

## Setup

Set `VITE_TMDB_READ_ACCESS_TOKEN` in the root `.env` file to your TMDB API Read Access Token (v4), not your v3 API key.

Vite embeds variables prefixed with `VITE_` in the browser bundle, so this read-only token is visible to users of the deployed app. Use a server-side proxy if the token must remain private, and revoke or rotate it if it is exposed.
