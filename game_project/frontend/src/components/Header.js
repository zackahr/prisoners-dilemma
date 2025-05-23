import { Link } from "react-router-dom"
import "./Header.css"

function Header() {
  return (
    <header className="header">
      <div className="header-container">
        <Link to="/" className="logo">
          <h1>Prisoner's Dilemma</h1>
        </Link>
        {/* <nav className="nav">
          <ul>
            <li>
              <Link to="/">Home</Link>
            </li>
            <li>
              <a href="#about">About</a>
            </li>
            <li>
              <a href="#contact">Contact</a>
            </li>
          </ul>
        </nav> */}
      </div>
    </header>
  )
}

export default Header
