
import { useState, useEffect, useRef } from "react"
import { useParams, useNavigate } from "react-router-dom"
import PayoffMatrix from "./PayoffMatrix"
import RoundHistory from "./RoundHistory"
import GameTimer from "./GameTimer"
import "./GameBoard.css"

function GameBoard({ playerFingerprint }) {
  const { matchId } = useParams()
  const navigate = useNavigate()
  const [connected, setConnected] = useState(false)
  const [gameState, setGameState] = useState({
    currentRound: 1,
    maxRounds: 25,
    player1Score: 0,
    player2Score: 0,
    player1CooperationPercent: 0,
    player2CooperationPercent: 0,
    roundHistory: [],
    waitingForOpponent: true,
    gameOver: false,
    player1LastAction: null,
    player2LastAction: null,
    gameMode: "online",
  })
  const [timeLeft, setTimeLeft] = useState(10)
  const [canMakeChoice, setCanMakeChoice] = useState(true)
  const [isPlayer1, setIsPlayer1] = useState(true)
  const [waitingForMyAction, setWaitingForMyAction] = useState(false)
  const [myFingerprint, setMyFingerprint] = useState("")
  const socketRef = useRef(null)

  // Connect to WebSocket
  useEffect(() => {
    if (!matchId) {
      navigate("/")
      return
    }

    // Get the fingerprint from localStorage if not provided
    // const fingerprint = playerFingerprint || localStorage.getItem("playerFingerprint")
    const fingerprint = playerFingerprint || localStorage.getItem("playerUUID")
    if (!fingerprint) {
      navigate("/")
      return
    }

    setMyFingerprint(fingerprint)
    console.log("Connecting with fingerprint:", fingerprint)

    // Create WebSocket connection
    // Use secure WebSocket if the page is served over HTTPS
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
    const host = window.location.host
    const socket = new WebSocket(`${protocol}//${host}/ws/game/${matchId}/`)
    socketRef.current = socket

    socket.onopen = () => {
      console.log("WebSocket connected")
      setConnected(true)
      // Send a join message to the server
      socket.send(
        JSON.stringify({
          action: "join",
          player_fingerprint: fingerprint,
        }),
      )
    }

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data)
      console.log("WebSocket message received:", data)

      // Handle game state updates
      if (data.game_state) {
        console.log("Game state update:", data.game_state)
        updateGameState(data.game_state, fingerprint)
      }

      // Handle individual player actions
      if (data.player_fingerprint && data.action) {
        console.log(`Player ${data.player_fingerprint} performed action: ${data.action}`)
        handlePlayerAction(data.player_fingerprint, data.action, fingerprint)
      }

      // Handle game over
      if (data.game_over) {
        console.log("Game over received:", data)
        setGameState((prevState) => ({
          ...prevState,
          gameOver: true,
          player1Score: data.player1_score,
          player2Score: data.player2_score,
          player1CooperationPercent: data.player1_cooperation,
          player2CooperationPercent: data.player2_cooperation,
        }))
      }

      // Handle errors
      if (data.error) {
        console.error("Error from server:", data.error)
        alert(data.error)
      }
    }

    socket.onclose = () => {
      console.log("WebSocket disconnected")
      setConnected(false)
    }

    socket.onerror = (error) => {
      console.error("WebSocket error:", error)
    }

    return () => {
      if (socket) {
        socket.close()
      }
    }
  }, [matchId, navigate, playerFingerprint])

  // Update game state from server
  const updateGameState = (newState, fingerprint) => {
    console.log("Updating game state with fingerprint:", fingerprint)
    console.log("New state:", newState)

    setGameState((prevState) => ({
      ...prevState,
      ...newState,
    }))

    // Determine if this client is player 1 or 2 based on the game state
    // We need to check the backend's game state to see which player we are
    if (newState.player1Fingerprint === fingerprint) {
      setIsPlayer1(true)
      console.log("I am Player 1")
    } else if (newState.player2Fingerprint === fingerprint) {
      setIsPlayer1(false)
      console.log("I am Player 2")
    }

    // Check if we need to wait for this player's action
    checkIfWaitingForMyAction(newState, fingerprint)

    // Reset timer if we're starting a new round
    if (!newState.waitingForOpponent && !newState.gameOver) {
      setTimeLeft(10)
      setCanMakeChoice(true)
    }
  }

  // Check if we're waiting for this player's action
  const checkIfWaitingForMyAction = (gameState, fingerprint) => {
    if (gameState.waitingForOpponent || gameState.gameOver) {
      setWaitingForMyAction(false)
      return
    }

    // Check if both players have made their moves for the current round
    const currentRoundNumber = gameState.currentRound
    const currentRoundData = gameState.roundHistory.find((r) => r.roundNumber === currentRoundNumber)

    if (!currentRoundData) {
      // New round - this player needs to act
      setWaitingForMyAction(true)
      console.log("New round - waiting for my action")
    } else {
      // Check if this player has already acted in the current round
      const isPlayer1 = gameState.player1Fingerprint === fingerprint
      const hasActed = isPlayer1 ? currentRoundData.player1Action : currentRoundData.player2Action

      if (!hasActed) {
        setWaitingForMyAction(true)
        console.log("I haven't acted yet in this round")
      } else {
        setWaitingForMyAction(false)
        console.log("I have already acted in this round")
      }
    }
  }

  // Handle player actions
  const handlePlayerAction = (actionPlayerFingerprint, action, myFingerprint) => {
    console.log(`Action from ${actionPlayerFingerprint}, my fingerprint: ${myFingerprint}`)

    // If this is my action, update UI accordingly
    if (actionPlayerFingerprint === myFingerprint) {
      setWaitingForMyAction(false)
      setCanMakeChoice(false)
      console.log("My action processed")
    }

    // If this is the opponent's action, update UI accordingly
    if (actionPlayerFingerprint !== myFingerprint) {
      console.log("Opponent's action processed")
      // The game state update will handle resetting for the next round
    }
  }

  // Make a choice (Cooperate or Defect)
  const makeChoice = (action) => {
    if (!canMakeChoice || !connected || gameState.waitingForOpponent || !waitingForMyAction) {
      console.log("Cannot make choice:", {
        canMakeChoice,
        connected,
        waitingForOpponent: gameState.waitingForOpponent,
        waitingForMyAction,
      })
      return
    }

    console.log(`Making choice: ${action}`)
    setCanMakeChoice(false)
    setWaitingForMyAction(false)

    // Send action to server
    if (socketRef.current) {
      socketRef.current.send(
        JSON.stringify({
          action,
          player_fingerprint: myFingerprint,
        }),
      )
    }
  }

  // Share match ID
  const shareMatchId = () => {
    navigator.clipboard
      .writeText(matchId)
      .then(() => {
        alert("Match ID copied to clipboard!")
      })
      .catch((err) => {
        console.error("Failed to copy match ID:", err)
      })
  }

  return (
    <div className="game-container">
      {!connected ? (
        <div className="connecting-screen">
          <div className="connecting-message">Connecting to game server...</div>
        </div>
      ) : gameState.waitingForOpponent ? (
        <div className="waiting-screen">
          <div className="waiting-message">
            <h2>Waiting for another player to join...</h2>
            <p>Share this match ID with your opponent:</p>
            <div className="match-id-box">
              <code>{matchId}</code>
              <button className="copy-button" onClick={shareMatchId}>
                Copy
              </button>
            </div>
            <p className="fingerprint-info">Your player ID: {myFingerprint}</p>
          </div>
          <PayoffMatrix />
        </div>
      ) : gameState.gameOver ? (
        <div className="game-over-screen">
          <h2>Game Over</h2>
          <div className="final-scores">
            <div className="score-box">
              <h3>Your Score</h3>
              <p>{isPlayer1 ? gameState.player1Score : gameState.player2Score}</p>
              <p className="cooperation-rate">
                Cooperation: {isPlayer1 ? gameState.player1CooperationPercent : gameState.player2CooperationPercent}%
              </p>
            </div>
            <div className="score-box">
              <h3>Opponent's Score</h3>
              <p>{isPlayer1 ? gameState.player2Score : gameState.player1Score}</p>
              <p className="cooperation-rate">
                Cooperation: {isPlayer1 ? gameState.player2CooperationPercent : gameState.player1CooperationPercent}%
              </p>
            </div>
          </div>
          <button className="play-again-button" onClick={() => navigate("/")}>
            Play Again
          </button>
          <RoundHistory history={gameState.roundHistory} isPlayer1={isPlayer1} />
        </div>
      ) : (
        <div className="game-screen">
          <div className="game-header">
            <h2>Game is ready to start!</h2>
            <p>Cooperate or Defect</p>
            <p className="player-info">
              You are Player {isPlayer1 ? "1" : "2"} | Round {gameState.currentRound} of {gameState.maxRounds}
            </p>
            {waitingForMyAction ? (
              <p className="action-status">Your turn to choose!</p>
            ) : (
              <p className="action-status">Waiting for opponent...</p>
            )}
          </div>

          <div className="game-timer-container">
            <GameTimer
              timeLeft={timeLeft}
              setTimeLeft={setTimeLeft}
              canMakeChoice={canMakeChoice && waitingForMyAction}
              onTimeUp={() => waitingForMyAction && makeChoice("Defect")}
            />
          </div>

          <div className="scores-container">
            <div className="score-box">
              <h3>Player 1:</h3>
              <p>{gameState.player1Score}</p>
            </div>
            <div className="score-box">
              <h3>Player 2:</h3>
              <p>{gameState.player2Score}</p>
            </div>
          </div>

          <div className="action-buttons">
            <button
              className={`cooperate-button ${!canMakeChoice || !waitingForMyAction ? "disabled" : ""}`}
              onClick={() => makeChoice("Cooperate")}
              disabled={!canMakeChoice || !waitingForMyAction}
            >
              Cooperate
            </button>
            <button
              className={`defect-button ${!canMakeChoice || !waitingForMyAction ? "disabled" : ""}`}
              onClick={() => makeChoice("Defect")}
              disabled={!canMakeChoice || !waitingForMyAction}
            >
              Defect
            </button>
          </div>

          <div className="score-reminder">
            <h3>Score Reminder</h3>
          </div>

          <PayoffMatrix />

          <div className="payoffs-table">
            <h3>Payoffs Table</h3>
            <div className="round-history-table">
              <table>
                <thead>
                  <tr>
                    <th>Player</th>
                    {Array.from({ length: 25 }, (_, i) => (
                      <th key={i + 1}>{i + 1}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Player 1</td>
                    {Array.from({ length: 25 }, (_, i) => {
                      const round = gameState.roundHistory.find((r) => r.roundNumber === i + 1)
                      return (
                        <td
                          key={i + 1}
                          className={
                            round
                              ? round.player1Points === 30
                                ? "high-score"
                                : round.player1Points === 0
                                  ? "zero-score"
                                  : ""
                              : ""
                          }
                        >
                          {round ? round.player1Points : 0}
                        </td>
                      )
                    })}
                  </tr>
                  <tr>
                    <td>Player 2</td>
                    {Array.from({ length: 25 }, (_, i) => {
                      const round = gameState.roundHistory.find((r) => r.roundNumber === i + 1)
                      return (
                        <td
                          key={i + 1}
                          className={
                            round
                              ? round.player2Points === 30
                                ? "high-score"
                                : round.player2Points === 0
                                  ? "zero-score"
                                  : ""
                              : ""
                          }
                        >
                          {round ? round.player2Points : 0}
                        </td>
                      )
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default GameBoard
