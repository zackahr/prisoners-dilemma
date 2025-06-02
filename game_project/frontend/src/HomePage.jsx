import { Link } from "react-router-dom"
import { ArrowRight, Users, Coins, Zap, Shield } from "lucide-react"
import "./HomePage.css"

function HomePage() {
  return (
    <div className="home-page">
      <div className="home-container">
        <div className="hero-section">
          <h1 className="hero-title">Game Theory Experiments</h1>
          <p className="hero-subtitle">Explore strategic decision-making through interactive economic games</p>
        </div>

        <div className="games-grid">
          <div className="game-card prisoners">
            <div className="game-card-content">
              <div className="game-icon-container">
                <Shield className="game-icon" />
                <Zap className="game-icon secondary" />
              </div>
              <h2 className="game-title">Prisoner's Dilemma</h2>
              <p className="game-description">
                A classic game theory scenario where two players must decide whether to cooperate or defect. Will you
                trust your opponent or prioritize self-interest?
              </p>
              <ul className="game-features">
                <li>
                  <Users className="feature-icon" />
                  <span>Play online with others or against AI</span>
                </li>
                <li>
                  <Coins className="feature-icon" />
                  <span>Earn points based on strategic choices</span>
                </li>
                <li>
                  <Zap className="feature-icon" />
                  <span>25 rounds of strategic decision-making</span>
                </li>
              </ul>
              <Link to="/prisoners" className="game-button">
                Play Prisoner's Dilemma
                <ArrowRight className="button-icon" />
              </Link>
            </div>
          </div>

          <div className="game-card ultimatum">
            <div className="game-card-content">
              <div className="game-icon-container">
                <Coins className="game-icon" />
              </div>
              <h2 className="game-title">Ultimatum Game</h2>
              <p className="game-description">
                One player proposes how to divide a sum of money, and the other can accept or reject. If rejected, both
                get nothing. What's a fair offer?
              </p>
              <ul className="game-features">
                <li>
                  <Users className="feature-icon" />
                  <span>Take turns as proposer and responder</span>
                </li>
                <li>
                  <Coins className="feature-icon" />
                  <span>Test theories of fairness and negotiation</span>
                </li>
                <li>
                  <Zap className="feature-icon" />
                  <span>Multiple rounds with different opponents</span>
                </li>
              </ul>
              <Link to="/ultimatum" className="game-button ultimatum-button">
                Play Ultimatum Game
                <ArrowRight className="button-icon" />
              </Link>
            </div>
          </div>
        </div>

        <div className="about-section">
          <h2 className="section-title">About These Experiments</h2>
          <p className="section-text">
            These interactive games are based on classic economic experiments that reveal insights about human behavior,
            cooperation, fairness, and strategic thinking. By participating, you'll experience firsthand the dilemmas
            that have fascinated economists, psychologists, and game theorists for decades.
          </p>
          <p className="section-text">
            All games are played anonymously, and your decisions contribute to ongoing research in behavioral economics.
            Enjoy the experience and see how your strategies compare to others!
          </p>
        </div>
      </div>
    </div>
  )
}

export default HomePage
