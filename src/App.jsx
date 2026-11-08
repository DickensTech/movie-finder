import { useCallback, useEffect, useRef, useState } from "react"
import { useDebounce } from "react-use"
import { getTrendingMovies, updateSearchCount } from "./appwrite.js"
import MovieCard from "./components/MovieCard.jsx"
import Search from "./components/Search.jsx"
import MovieSkeleton from "./components/MovieSkeleton.jsx"
import Spinner from "./components/Spinner.jsx"

const API_BASE_URL = "https://api.themoviedb.org/3"
const TMDB_READ_ACCESS_TOKEN = import.meta.env.VITE_TMDB_READ_ACCESS_TOKEN
const FAVORITES_STORAGE_KEY = "movie-favorites"
const THEME_STORAGE_KEY = "movie-theme"
const SORT_OPTIONS = {
  popularity: "popularity.desc",
  rating: "vote_average.desc",
  release_date: "primary_release_date.desc",
}

const getMovieQueryKey = (query, genre, sort, year) => {
  const normalizedQuery = query.trim()
  return JSON.stringify([normalizedQuery, genre, year, normalizedQuery ? null : sort])
}

const readStoredValue = (key, fallback) => {
  try {
    const storedValue = localStorage.getItem(key)
    return storedValue ? JSON.parse(storedValue) : fallback
  } catch (error) {
    console.error(`Unable to read ${key} from localStorage:`, error)
    return fallback
  }
}

const getApiOptions = () => ({
  method: "GET",
  headers: {
    accept: "application/json",
    Authorization: `Bearer ${TMDB_READ_ACCESS_TOKEN}`,
  },
})

const getErrorMessage = (error) =>
  error instanceof Error ? error.message : "Something went wrong. Please try again."

const App = () => {
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const [movieList, setMovieList] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [genres, setGenres] = useState([])
  const [genreError, setGenreError] = useState("")
  const [selectedGenre, setSelectedGenre] = useState("")
  const [sortBy, setSortBy] = useState("popularity")
  const [selectedYear, setSelectedYear] = useState("")
  const [showFavorites, setShowFavorites] = useState(false)
  const [favorites, setFavorites] = useState(() => {
    const storedFavorites = readStoredValue(FAVORITES_STORAGE_KEY, [])
    return Array.isArray(storedFavorites) ? storedFavorites : []
  })
  const [theme, setTheme] = useState(() => {
    const storedTheme = readStoredValue(THEME_STORAGE_KEY, "dark")
    return storedTheme === "light" ? "light" : "dark"
  })
  const [trendingMovies, setTrendingMovies] = useState([])
  const [selectedMovie, setSelectedMovie] = useState(null)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [detailsError, setDetailsError] = useState("")
  const [similarMovies, setSimilarMovies] = useState([])
  const [loadingSimilar, setLoadingSimilar] = useState(false)
  const [similarError, setSimilarError] = useState("")
  const movieRequestId = useRef(0)
  const detailsRequestId = useRef(0)
  const loadedMovieQueryKey = useRef("")
  const inFlightMovieQueryKey = useRef("")

  useDebounce(() => setDebouncedSearchTerm(searchTerm), 500, [searchTerm])

  const loadTrendingMovies = useCallback(async () => {
    try {
      const movies = await getTrendingMovies()
      setTrendingMovies(movies)
    } catch (error) {
      console.error("Error fetching trending movies:", error)
    }
  }, [])

  const fetchMovies = useCallback(async (
    query,
    genre,
    requestedPage,
    append,
    sort,
    year,
  ) => {
    const requestId = ++movieRequestId.current
    const queryKey = getMovieQueryKey(query, genre, sort, year)
    setErrorMessage("")
    if (append) {
      setLoadingMore(true)
    } else {
      setLoading(true)
      setMovieList([])
      setHasMore(false)
      inFlightMovieQueryKey.current = queryKey
    }

    try {
      if (!TMDB_READ_ACCESS_TOKEN) {
        console.error("TMDB Read Access Token is missing. Set VITE_TMDB_READ_ACCESS_TOKEN.")
        throw new Error("Movies are temporarily unavailable.")

      }

      const params = new URLSearchParams({
        page: String(requestedPage),
        language: "en-US",
      })
      let endpoint

      if (query.trim()) {
        params.set("query", query.trim())
        if (year) params.set("year", year)
        endpoint = `${API_BASE_URL}/search/movie?${params}`
      } else {
        params.set("sort_by", SORT_OPTIONS[sort])
        if (year) params.set("primary_release_year", year)
        if (sort === "rating") params.set("vote_count.gte", "200")
        if (sort === "release_date") {
          params.set("primary_release_date.lte", new Date().toISOString().slice(0, 10))
        }
        if (genre) params.set("with_genres", genre)
        endpoint = `${API_BASE_URL}/discover/movie?${params}`
      }

      const response = await fetch(endpoint, getApiOptions())
      if (!response.ok) {
        throw new Error(`Failed to fetch movies (HTTP ${response.status}).`)
      }

      const data = await response.json()
      if (requestId !== movieRequestId.current) return

      const results = data.results || []
      setMovieList((currentMovies) => append ? [...currentMovies, ...results] : results)
      setPage(requestedPage)
      setHasMore(requestedPage < (data.total_pages || 1))
      if (!append) loadedMovieQueryKey.current = queryKey

      if (!append && query.trim() && results.length > 0) {
        try {
          await updateSearchCount(query.trim(), results[0])
        } catch (error) {
          console.error("Error updating search count:", error)
        }
        try {
          await loadTrendingMovies()
        } catch (error) {
          console.error("Error loading trending movies:", error)
        }
      }
    } catch (error) {
      if (requestId === movieRequestId.current) {
        setErrorMessage(getErrorMessage(error))
      }
    } finally {
      if (requestId === movieRequestId.current) {
        setLoading(false)
        setLoadingMore(false)
        if (!append && inFlightMovieQueryKey.current === queryKey) {
          inFlightMovieQueryKey.current = ""
        }
      }
    }
  }, [loadTrendingMovies])

  const fetchGenres = useCallback(async () => {
    setGenreError("")
    try {
      if (!TMDB_READ_ACCESS_TOKEN) {

        console.error("TMDB Read Access Token is missing. Set VITE_TMDB_READ_ACCESS_TOKEN.")
        throw new Error("Movies are temporarily unavailable.")
      }

      const response = await fetch(
        `${API_BASE_URL}/genre/movie/list?language=en-US`,
        getApiOptions(),
      )
      if (!response.ok) {
        throw new Error(`Failed to fetch genres (HTTP ${response.status}).`)
      }

      const data = await response.json()
      setGenres(data.genres || [])
    } catch (error) {
      setGenreError(getErrorMessage(error))
    }
  }, [])

  useEffect(() => {
    if (showFavorites) return

    const queryKey = getMovieQueryKey(debouncedSearchTerm, selectedGenre, sortBy, selectedYear)
    if (loadedMovieQueryKey.current === queryKey || inFlightMovieQueryKey.current === queryKey) return

    void fetchMovies(debouncedSearchTerm, selectedGenre, 1, false, sortBy, selectedYear)
  }, [debouncedSearchTerm, selectedGenre, fetchMovies, selectedYear, showFavorites, sortBy])

  useEffect(() => {
    try {
      localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites))
    } catch (error) {
      console.error("Unable to save favorites to localStorage:", error)
    }
  }, [favorites])

  useEffect(() => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(theme))
    } catch (error) {
      console.error("Unable to save theme to localStorage:", error)
    }
  }, [theme])

  useEffect(() => {
    void fetchGenres()
    void loadTrendingMovies()
  }, [fetchGenres, loadTrendingMovies])

  useEffect(() => {
    if (!selectedMovie) return undefined

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        detailsRequestId.current += 1
        setSelectedMovie(null)
        setLoadingDetails(false)
        setSimilarMovies([])
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    document.body.style.overflow = "hidden"

    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      document.body.style.overflow = ""
    }
  }, [selectedMovie])

  const handleSearchChange = (value) => {
    setSearchTerm(value)
    if (value) setSelectedGenre("")
  }

  const handleGenreSelect = (genreId) => {
    setSelectedGenre(genreId)
    setSearchTerm("")
    setDebouncedSearchTerm("")
  }

  const toggleFavorite = (movie) => {
    setFavorites((currentFavorites) => currentFavorites.some((item) => item.id === movie.id)
      ? currentFavorites.filter((item) => item.id !== movie.id)
      : [...currentFavorites, movie])
  }

  const openMovieDetails = async (movie) => {
    const requestId = ++detailsRequestId.current
    setSelectedMovie(movie)
    setLoadingDetails(true)
    setDetailsError("")
    setSimilarMovies([])
    setSimilarError("")
    setLoadingSimilar(true)

    try {
      if (!TMDB_READ_ACCESS_TOKEN) {
        console.error("TMDB Read Access Token is missing. Set VITE_TMDB_READ_ACCESS_TOKEN.")
        throw new Error("Movie details are temporarily unavailable.")
      }

      const response = await fetch(
        `${API_BASE_URL}/movie/${movie.id}?append_to_response=videos&language=en-US`,
        getApiOptions(),
      )
      if (!response.ok) {
        throw new Error(`Failed to fetch movie details (HTTP ${response.status}).`)
      }

      const details = await response.json()
      if (requestId === detailsRequestId.current) setSelectedMovie(details)
    } catch (error) {
      if (requestId === detailsRequestId.current) setDetailsError(getErrorMessage(error))
    } finally {
      if (requestId === detailsRequestId.current) setLoadingDetails(false)
    }

    try {
      if (!TMDB_READ_ACCESS_TOKEN) {
        
        console.error("TMDB Read Access Token is missing. Set VITE_TMDB_READ_ACCESS_TOKEN.")
        throw new Error("Movies are temporarily unavailable.") 
        
      }

      const response = await fetch(
        `${API_BASE_URL}/movie/${movie.id}/similar?language=en-US&page=1`,
        getApiOptions(),
      )
      if (!response.ok) {
        throw new Error(`Failed to fetch similar movies (HTTP ${response.status}).`)
      }

      const data = await response.json()
      if (requestId === detailsRequestId.current) setSimilarMovies(data.results || [])
    } catch (error) {
      if (requestId === detailsRequestId.current) setSimilarError(getErrorMessage(error))
    } finally {
      if (requestId === detailsRequestId.current) setLoadingSimilar(false)
    }
  }

  const closeMovieDetails = () => {
    detailsRequestId.current += 1
    setSelectedMovie(null)
    setLoadingDetails(false)
    setLoadingSimilar(false)
  }

  const loadMoreMovies = () => {
    void fetchMovies(debouncedSearchTerm, selectedGenre, page + 1, true, sortBy, selectedYear)
  }

  const retryMovies = () => {
    void fetchMovies(debouncedSearchTerm, selectedGenre, 1, false, sortBy, selectedYear)
  }

  const visibleMovies = (showFavorites ? favorites : movieList)
    .filter((movie) => !selectedYear || movie.release_date?.startsWith(`${selectedYear}-`))
    .sort((first, second) => {
      if (sortBy === "rating") return (second.vote_average || 0) - (first.vote_average || 0)
      if (sortBy === "release_date") {
        return (second.release_date || "").localeCompare(first.release_date || "")
      }
      return (second.popularity || 0) - (first.popularity || 0)
    })

  const trailer = selectedMovie?.videos?.results
    ?.filter((video) => video.site === "YouTube" && video.type === "Trailer")
    .sort((first, second) => Number(second.official) - Number(first.official))[0]

  return (
    <main className={`app-theme-${theme}`}>
      <div className="pattern" />

      <div className="wrapper">
        <header>
          <img src="/hero.png" alt="Hero Banner" />
          <h1>
            Find <span className="text-gradient">Movies</span>
            {" "}You&apos;ll Enjoy without the Hassle
          </h1>
          <Search searchTerm={searchTerm} setSearchTerm={handleSearchChange} />
          <nav className="view-toolbar" aria-label="Movie list and appearance">
            <div className="view-tabs">
              <button
                type="button"
                className={`genre-chip${!showFavorites ? " is-selected" : ""}`}
                aria-pressed={!showFavorites}
                onClick={() => setShowFavorites(false)}
              >
                All movies
              </button>
              <button
                type="button"
                className={`genre-chip${showFavorites ? " is-selected" : ""}`}
                aria-pressed={showFavorites}
                onClick={() => setShowFavorites(true)}
              >
                My list ({favorites.length})
              </button>
            </div>
            <button
              type="button"
              className="genre-chip theme-toggle"
              onClick={() => setTheme((currentTheme) => currentTheme === "dark" ? "light" : "dark")}
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
            >
              {theme === "dark" ? "Light theme" : "Dark theme"}
            </button>
          </nav>
        </header>

        {!showFavorites && trendingMovies.length > 0 && (
          <section className="trending">
            <h2>Trending Movies</h2>
            <ul>
              {trendingMovies.map((movie, index) => (
                <li key={movie.$id}>
                  <p>{index + 1}</p>
                  <img src={movie.poster_url} alt={movie.searchTerm} />
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="all-movies">
          <h2>{showFavorites ? "My list" : "All movies"}</h2>

          {!showFavorites && <div className="genre-filter" aria-label="Filter movies by genre">
            <button
              type="button"
              className={`genre-chip${selectedGenre === "" ? " is-selected" : ""}`}
              aria-pressed={selectedGenre === ""}
              onClick={() => handleGenreSelect("")}
            >
              All
            </button>
            {genres.map((genre) => (
              <button
                type="button"
                key={genre.id}
                className={`genre-chip${selectedGenre === String(genre.id) ? " is-selected" : ""}`}
                aria-pressed={selectedGenre === String(genre.id)}
                onClick={() => handleGenreSelect(String(genre.id))}
              >
                {genre.name}
              </button>
            ))}
            {genreError && (
              <span className="genre-error" role="status">
                {genreError}{" "}
                <button type="button" onClick={() => void fetchGenres()}>Retry</button>
              </span>
            )}
          </div>}

          <div className="sort-filter-bar">
            <label>
              Sort by
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                <option value="popularity">Popularity</option>
                <option value="rating">Rating</option>
                <option value="release_date">Release date</option>
              </select>
            </label>
            <label>
              Year
              <select value={selectedYear} onChange={(event) => setSelectedYear(event.target.value)}>
                <option value="">All years</option>
                {Array.from({ length: new Date().getFullYear() - 1899 }, (_, index) =>
                  String(new Date().getFullYear() - index),
                ).map((year) => <option key={year} value={year}>{year}</option>)}
              </select>
            </label>
          </div>

          {!showFavorites && loading && movieList.length === 0 ? (
            <ul aria-label="Loading movies" aria-busy="true">
              {Array.from({ length: 8 }, (_, index) => <MovieSkeleton key={index} />)}
            </ul>
          ) : !showFavorites && errorMessage && movieList.length === 0 ? (
            <div className="movie-message" role="alert">
              <p>{errorMessage}</p>
              <button type="button" className="action-button" onClick={retryMovies}>Retry</button>
            </div>
          ) : visibleMovies.length === 0 ? (
            <div className="movie-message">
              <p>
                {showFavorites
                  ? "Your list is empty. Add movies with the heart button."
                  : debouncedSearchTerm.trim()
                  ? `No movies found for ‘${debouncedSearchTerm.trim()}’.`
                  : "No movies found. Try another genre."}
              </p>
            </div>
          ) : (
            <>
              <ul>
                {visibleMovies.map((movie) => (
                  <MovieCard
                    key={movie.id}
                    movie={movie}
                    onSelect={openMovieDetails}
                    isFavorite={favorites.some((favorite) => favorite.id === movie.id)}
                    onToggleFavorite={toggleFavorite}
                  />
                ))}
              </ul>
              {!showFavorites && hasMore && (
                <div className="load-more">
                  <button
                    type="button"
                    className="action-button"
                    onClick={loadMoreMovies}
                    disabled={loadingMore}
                  >
                    {loadingMore ? "Loading…" : "Load more"}
                  </button>
                  {loadingMore && <Spinner label="Loading more movies" />}
                </div>
              )}
              {!showFavorites && errorMessage && (
                <div className="movie-message" role="alert">
                  <p>{errorMessage}</p>
                  <button type="button" className="action-button" onClick={loadMoreMovies}>Retry</button>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      <footer className="tmdb-attribution">
        <a href="https://www.themoviedb.org/" target="_blank" rel="noreferrer">
          <img src="/tmdb-logo.svg" alt="TMDB logo" />
        </a>
        <p>This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
      </footer>

      {selectedMovie && (
        <div className="modal-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeMovieDetails()
        }}>
          <section
            className="movie-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="movie-modal-title"
          >
            <button
              type="button"
              className="modal-close"
              aria-label="Close movie details"
              onClick={closeMovieDetails}
            >
              ×
            </button>
            {loadingDetails ? (
              <Spinner label="Loading movie details" />
            ) : detailsError ? (
              <div className="movie-message" role="alert">
                <p>{detailsError}</p>
                <button
                  type="button"
                  className="action-button"
                  onClick={() => void openMovieDetails(selectedMovie)}
                >
                  Retry
                </button>
              </div>
            ) : (
              <>
                <div className="modal-heading">
                  {selectedMovie.poster_path && (
                    <img
                      className="modal-poster"
                      src={`https://image.tmdb.org/t/p/w500${selectedMovie.poster_path}`}
                      alt=""
                    />
                  )}
                  <div>
                    <h2 id="movie-modal-title">{selectedMovie.title}</h2>
                    <p className="modal-meta">
                      {selectedMovie.genres?.map((genre) => genre.name).join(" · ") || "Genres unavailable"}
                    </p>
                    <p className="modal-meta">
                      {selectedMovie.runtime ? `${selectedMovie.runtime} min` : "Runtime unavailable"}
                    </p>
                  </div>
                </div>
                <h3>Overview</h3>
                <p className="modal-overview">
                  {selectedMovie.overview || "No overview is available for this movie."}
                </p>
                <h3>Trailer</h3>
                {trailer ? (
                  <div className="trailer-frame">
                    <iframe
                      src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(trailer.key)}`}
                      title={`${selectedMovie.title} trailer`}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      referrerPolicy="strict-origin-when-cross-origin"
                      allowFullScreen
                    />
                  </div>
                ) : (
                  <p className="modal-meta">No trailer is available.</p>
                )}
                <h3>Similar movies</h3>
                {loadingSimilar ? (
                  <ul className="similar-movies" aria-label="Loading similar movies" aria-busy="true">
                    {Array.from({ length: 4 }, (_, index) => <MovieSkeleton key={index} />)}
                  </ul>
                ) : similarError ? (
                  <div className="movie-message" role="alert">
                    <p>{similarError}</p>
                  </div>
                ) : similarMovies.length > 0 ? (
                  <ul className="similar-movies">
                    {similarMovies.slice(0, 4).map((movie) => (
                      <MovieCard
                        key={movie.id}
                        movie={movie}
                        onSelect={openMovieDetails}
                        isFavorite={favorites.some((favorite) => favorite.id === movie.id)}
                        onToggleFavorite={toggleFavorite}
                      />
                    ))}
                  </ul>
                ) : (
                  <p className="modal-meta">No similar movies are available.</p>
                )}
              </>
            )}
          </section>
        </div>
      )}
    </main>
  )
}

export default App
