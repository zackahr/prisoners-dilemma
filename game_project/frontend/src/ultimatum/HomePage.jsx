import { Users, Bot, Coins } from "lucide-react"
import { useNavigate } from "react-router-dom"
import "./HomePage.css"

export default function HomePage() {
  const navigate = useNavigate()

  const handleStartGame = (mode) => {
    if (mode === "online") {
      navigate("/ultimatum/matchmaking")
    } else {
      navigate(`/ultimatum/game?mode=${mode}`)
    }
  }

  return (
    <div className="homepage">
      <div className="homepage-container">
        <div className="homepage-header">
          <h1 className="homepage-title">Ultimatum</h1>
          <p className="homepage-subtitle">
            You and a player are dividing a stack of coins. If the other player rejects your proposal, you both get
            nothing. How much will you offer?
          </p>
        </div>

        {/* Game Description Card */}
        <div className="how-to-play-card">
          <div className="how-to-play-header">
            <Coins className="how-to-play-icon" />
            <h2 className="how-to-play-title">How to Play</h2>
          </div>
          <div className="how-to-play-steps">
            <div className="step">
              <div className="step-number">
                <span>1</span>
              </div>
              <h3 className="step-title">Make an Offer</h3>
              <p className="step-description">Decide how much of the $100 to offer your opponent</p>
            </div>
            <div className="step">
              <div className="step-number">
                <span>2</span>
              </div>
              <h3 className="step-title">Wait for Decision</h3>
              <p className="step-description">Your opponent will accept or reject your offer</p>
            </div>
            <div className="step">
              <div className="step-number">
                <span>3</span>
              </div>
              <h3 className="step-title">Get Results</h3>
              <p className="step-description">If accepted, you both get money. If rejected, nobody gets anything</p>
            </div>
          </div>
          
          <div className="how-to-play-instructions">
            <div className="instruction-section">
              <p className="instruction-intro">
                You are about to play <strong>20 rounds</strong> of a two-simultaneous ultimatum game with the same other player.
              </p>
              
              <div className="instruction-details">
                <h4>In each round:</h4>
                <ul>
                  <li>You will <strong>make an offer</strong>: decide how to split 100 coins between you and the other player.</li>
                  <li>The other player will also make an offer at the same time.</li>
                  <li>Then, you'll see the other player's offer and choose to <strong>accept or reject it</strong>.</li>
                  <li>At the same time, the other player will decide whether to accept your offer.</li>
                  <li>Proposals are only valid if they are accepted. If a proposal is rejected, it is invalid and no coins are given from it.</li>
                </ul>
              </div>
              
              <div className="examples-section">
                <h4>Examples:</h4>
                
                <div className="example">
                  <h5><strong>Example 1: Both offers accepted</strong></h5>
                  <p>You offer: keep 40, give 60 → they accept</p>
                  <p>They offer: keep 70, give 30 → you accept</p>
                  <p className="example-result">✅ You earn: 40 + 30 = <strong>70 coins</strong></p>
                </div>
                
                <div className="example">
                  <h5><strong>Example 2: You reject, they accept</strong></h5>
                  <p>You offer: keep 50, give 50 → they accept</p>
                  <p>They offer: keep 90, give 10 → you reject</p>
                  <p className="example-result">✅ You earn: 50 + 0 = <strong>50 coins</strong></p>
                </div>
                
                <div className="example">
                  <h5><strong>Example 3: Both offers rejected</strong></h5>
                  <p>Both of you reject each other's offer</p>
                  <p className="example-result">❌ You earn: <strong>0 coins</strong></p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Game Mode Selection */}
        <div className="game-modes">
          <div className="game-mode-card">
            <div className="game-mode-icon-container">
              <Users className="game-mode-icon" />
            </div>
            <h3 className="game-mode-title">Play Online</h3>
            <p className="game-mode-description">Challenge a real player in our matchmaking system</p>
            <button onClick={() => handleStartGame("online")} className="game-mode-button online-button">
              Find Opponent
            </button>
          </div>

          <div className="game-mode-card">
            <div className="game-mode-icon-container">
              <Bot className="game-mode-icon" />
            </div>
            <h3 className="game-mode-title">Play with Bot</h3>
            <p className="game-mode-description">Practice against our AI opponent</p>
            <button onClick={() => handleStartGame("bot")} className="game-mode-button bot-button">
              Start Game
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}