const Spinner = ({ label = "Loading" }) => (
  <div className="loading-indicator" role="status" aria-label={label}>
    <span className="loading-orbit" aria-hidden="true">
      <span />
    </span>
    <span className="loading-label">{label}</span>
  </div>
)

export default Spinner
