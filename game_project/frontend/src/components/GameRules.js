import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import PayoffMatrix from "./PayoffMatrix"
import "./GameRules.css"

function GameRules({ setMatchId, setPlayerFingerprint }) {
  const [gameMode, setGameMode] = useState("online")
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const getOrCreateUUID = () => {
        const stored = localStorage.getItem("playerUUID");
        if (stored) return stored;           // reuse
        const uuid = crypto.randomUUID();    // brand-new
        localStorage.setItem("playerUUID", uuid);
        return uuid;
    };

    const uuid = getOrCreateUUID();
    setPlayerFingerprint(uuid);
    console.log("Your player UUID:", uuid);
  }, [setPlayerFingerprint])

  const startGame = async () => {
    setIsLoading(true)
    try {
      const playerFingerprint = localStorage.getItem("playerUUID")
      console.log("Starting game with fingerprint:", playerFingerprint)

      // Create a new game match
      const response = await fetch("/api/create_match/", {
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

      // if (data.status && data.status.includes("match")) {
      if (data.status === "error") {
        // show nice pop-up instead of alert
        window.dispatchEvent(new CustomEvent("GLOBAL_MODAL", {
           detail: {title:"Hold on!", msg: data.message}
        }));
        return;
      }
      if (data.status && data.status.includes("match")) {
        setMatchId(data.match_id)
        // Navigate to the game board
        navigate(`/game/${data.match_id}`)
      } else {
        console.error("Error creating game:", data.message)
        alert("Failed to create game. Please try again.")
      }
    } catch (error) {
      console.error("Error starting game:", error)
      // alert("Failed to connect to server. Please try again."
      window.dispatchEvent(new CustomEvent("GLOBAL_MODAL", {
            detail:{title:"Network problem", msg:"Could not reach the server."}
        }));
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="game-rules">
      <h2>Repeated Prisoner's Dilemma</h2>

      <div className="rules-content">
        <h3>Game Rules</h3>
        <p>
          Play the Prisoner's Dilemma against another player. You will engage in multiple rounds of the game with the
          following payoff matrix:
        </p>

        <PayoffMatrix />

        <p>
          In this game, you will compete against an opponent for multiple rounds. During each round, you must decide
          whether to "Cooperate" or "Defect." The statistics will track your average earnings across all rounds. After
          completing all rounds, a summary screen will display your average payoffs compared to your opponent.
        </p>

        <div className="strategy-tips">
          <h3>Strategy Tips</h3>
          <ul>
            <li>If both players cooperate, both get a moderate reward (20 points each)</li>
            <li>
              If one player defects while the other cooperates, the defector gets a high reward (30 points) while the
              cooperator gets nothing
            </li>
            <li>If both players defect, both get a low reward (10 points each)</li>
            <li>Consider how your choices might influence your opponent's future decisions</li>
          </ul>
        </div>

        <div className="game-mode-selection">
          <h3>Game Mode</h3>
          <div className="mode-options">
            <button
              className={`mode-button ${gameMode === "online" ? "active" : ""}`}
              onClick={() => setGameMode("online")}
            >
              Play Online
            </button>
            <button className={`mode-button ${gameMode === "bot" ? "active" : ""}`} onClick={() => setGameMode("bot")}>
              Play Against Bot
            </button>
          </div>
        </div>

        <button className="start-button" onClick={startGame} disabled={isLoading}>
          {isLoading ? "Creating Game..." : "Let's Go Playing"}
        </button>
      </div>
    </div>
  )
}

export default GameRules
