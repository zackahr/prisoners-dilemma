import { Link } from "react-router-dom"
import "./Header.css"

function Header() {
  return (
    <header className="header">
      <div className="header-container">
        <Link to="/" className="logo">
          <h1>Prisoner's Dilemma</h1>
        </Link>
      </div>
    </header>
  )
}

export default Header
