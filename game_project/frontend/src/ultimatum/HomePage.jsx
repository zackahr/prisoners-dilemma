"use client"

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
