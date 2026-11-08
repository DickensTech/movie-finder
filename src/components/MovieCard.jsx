const MovieCard = ({ movie, onSelect, isFavorite, onToggleFavorite }) => {
  const { title, vote_average, poster_path, release_date, original_language } = movie

  return (
    <li className="movie-card">
      <button
        type="button"
        className={`favorite-button${isFavorite ? " is-favorite" : ""}`}
        aria-label={isFavorite ? `Remove ${title} from My list` : `Add ${title} to My list`}
        aria-pressed={isFavorite}
        onClick={() => onToggleFavorite(movie)}
      >
        {isFavorite ? "♥" : "♡"}
      </button>
      <button type="button" className="movie-card-button" onClick={() => onSelect(movie)}>
        <img
          src={poster_path ? `https://image.tmdb.org/t/p/w500${poster_path}` : "/no-movie.png"}
          alt={title}
        />

        <div className="mt-4">
          <h3>{title}</h3>

          <div className="content">
            <div className="rating">
              <img src="/star.svg" alt="" />
              <p>{vote_average ? vote_average.toFixed(1) : "N/A"}</p>
            </div>

            <span>•</span>
            <p className="lang">{original_language}</p>

            <span>•</span>
            <p className="year">{release_date ? release_date.split("-")[0] : "N/A"}</p>
          </div>
        </div>
      </button>
    </li>
  )
}

export default MovieCard