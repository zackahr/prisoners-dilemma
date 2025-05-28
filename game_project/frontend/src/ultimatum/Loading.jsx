import "./Loading.css"

export default function Loading() {
  return (
    <div className="loading-page">
      <div className="loading-content">
        <div className="loading-spinner"></div>
        <p className="loading-text">Loading...</p>
      </div>
    </div>
  )
}
