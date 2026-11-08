# 🎬 Movie Finder

### Find your next favorite movie.

Search, browse, and build a watchlist in a movie discovery app powered by the [TMDB API](https://www.themoviedb.org/).

## ✨ Explore

- Search a wide catalog of movies
- Browse trending titles and filter by genre
- Sort by popularity, rating, or release date
- Narrow results by year
- Open movie details, watch available trailers, and discover similar films
- Save favorites to **My list**
- Switch between dark and light themes

## 🚀 Get started

### 1. Install dependencies

```bash
npm install
```

### 2. Add your TMDB token

Create a `.env` file in the project root and add your TMDB **API Read Access Token (v4)**:

```env
VITE_TMDB_READ_ACCESS_TOKEN=your_tmdb_v4_read_access_token
```

This app sends the token as a Bearer token. A v3 API key is a different credential and will not work here.

> **Token visibility:** Vite includes `VITE_` variables in the client-side bundle. The read-only token is visible to users of the deployed app. If you need to keep it private, route TMDB requests through a server-side proxy.

### 3. Start the development server

```bash
npm run dev
```

Open the local URL printed by Vite, then start exploring.

## 🧰 Built with

React · Vite · Tailwind CSS · Appwrite · TMDB API

## 📜 Available commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the local development server |
| `npm run build` | Create a production build in `dist` |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Check the project with ESLint |

## 🙌 Credits

This product uses the TMDB API but is not endorsed or certified by TMDB.
