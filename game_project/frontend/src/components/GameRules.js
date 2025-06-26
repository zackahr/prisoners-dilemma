import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Users, Bot, Coins, Trophy, Target } from "lucide-react"
import PayoffMatrix from "./PayoffMatrix"
import "./GameRules.css"

function GameRules({ setMatchId, setPlayerFingerprint }) {
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const getOrCreateUUID = () => {
      const stored = localStorage.getItem("playerUUID")
      if (stored) return stored // reuse
      const uuid = crypto.randomUUID() // brand-new
      localStorage.setItem("playerUUID", uuid)
      return uuid
    }

    const uuid = getOrCreateUUID()
    setPlayerFingerprint(uuid)
    console.log("Your player UUID:", uuid)
  }, [setPlayerFingerprint])

  const handleStartGame = async (gameMode) => {
    setIsLoading(true)
    try {
      const playerFingerprint = localStorage.getItem("playerUUID")
      console.log("Starting game with fingerprint:", playerFingerprint)

      // Create a new game match
      const response = await fetch("/api/prisoners/create_match/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          game_mode: gameMode,
          player_fingerprint: playerFingerprint,
        }),
      })

      const data = await response.json()
      console.log("Server response:", data)

      if (data.status === "error") {
        window.dispatchEvent(
          new CustomEvent("GLOBAL_MODAL", {
            detail: { title: "Hold on!", msg: data.message },
          }),
        )
        return
      }
      if (data.status && data.status.includes("match")) {
        setMatchId(data.match_id)
        navigate(`/prisoners/game/${data.match_id}`)
      } else {
        console.error("Error creating game:", data.message)
        alert("Failed to create game. Please try again.")
      }
    } catch (error) {
      console.error("Error starting game:", error)
      window.dispatchEvent(
        new CustomEvent("GLOBAL_MODAL", {
          detail: { title: "Network problem", msg: "Could not reach the server." },
        }),
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="game-rules-page">
      <div className="game-rules-container">
        <div className="game-rules-header">
          <h1 className="game-rules-title">Prisoner's Dilemma</h1>
          <p className="game-rules-subtitle">
            Engage in strategic decision-making with another player. Will you cooperate or defect? Your choices shape
            the outcome in this classic game theory experiment.
          </p>
        </div>

        {/* How to Play Section */}
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
              <h3 className="step-title">Choose Your Action</h3>
              <p className="step-description">Each round, decide whether to Cooperate or Defect</p>
            </div>
            <div className="step">
              <div className="step-number">
                <span>2</span>
              </div>
              <h3 className="step-title">See the Results</h3>
              <p className="step-description">Points are awarded based on both players' choices</p>
            </div>
            <div className="step">
              <div className="step-number">
                <span>3</span>
              </div>
              <h3 className="step-title">Play 25 Rounds</h3>
              <p className="step-description">Accumulate points across multiple rounds to win</p>
            </div>
          </div>
        </div>

        {/* Payoff Matrix */}
        <div className="payoff-section">
          <h3 className="payoff-title">Payoff Matrix</h3>
          <PayoffMatrix />
        </div>

        {/* Game Mode Selection */}
        <div className="game-modes">
          <div className="game-mode-card">
            <div className="game-mode-icon-container">
              <Users className="game-mode-icon" />
            </div>
            <h3 className="game-mode-title">Play Online</h3>
            <p className="game-mode-description">Challenge a real player in strategic decision-making</p>
            <button
              onClick={() => handleStartGame("online")}
              className="game-mode-button online-button"
              disabled={isLoading}
            >
              {isLoading ? "Creating Game..." : "Find Opponent"}
            </button>
          </div>

          <div className="game-mode-card">
            <div className="game-mode-icon-container">
              <Bot className="game-mode-icon" />
            </div>
            <h3 className="game-mode-title">Play with Bot</h3>
            <p className="game-mode-description">Practice against our intelligent AI opponent</p>
            <button
              onClick={() => handleStartGame("bot")}
              className="game-mode-button bot-button"
              disabled={isLoading}
            >
              {isLoading ? "Creating Game..." : "Start Game"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default GameRules