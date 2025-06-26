import { useState, useEffect, useRef } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Clock, Users, Bot, Trophy, Target, Zap, Shield } from "lucide-react"
import PayoffMatrix from "./PayoffMatrix"
import RoundHistory from "./RoundHistory"
import GameTimer from "./GameTimer"
import "./GameBoard.css"
import Modal from "./Modal"
import PayoffsTable from "./PayoffsTable"

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
  const [modal, setModal] = useState({ open: false, title: "", msg: "" })
  const [roundPhase, setRoundPhase] = useState("choosing") // 'choosing' or 'results'
  const [lastRoundResult, setLastRoundResult] = useState(null)

  // Connect to WebSocket
  useEffect(() => {
    if (!matchId) {
      navigate("/prisoners")
      return
    }
    const fingerprint = playerFingerprint || localStorage.getItem("playerUUID")
    if (!fingerprint) {
      navigate("/prisoners")
      return
    }

    setMyFingerprint(fingerprint)
    console.log("Connecting with fingerprint:", fingerprint)

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
    const host = window.location.host
    const socket = new WebSocket(`${protocol}//${host}/ws/game/${matchId}/`)
    socketRef.current = socket

    socket.onopen = () => {
      console.log("WebSocket connected")
      setConnected(true)
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

      if (data.game_state) {
        console.log("Game state update:", data.game_state)
        updateGameState(data.game_state, fingerprint)
      }
      if (data.game_aborted) {
        setModal({
          open: true,
          title: "Match Ended",
          msg: data.message,
        })
        return
      }
      if (data.player_fingerprint && data.action) {
        console.log(`Player ${data.player_fingerprint} performed action: ${data.action}`)
        handlePlayerAction(data.player_fingerprint, data.action, fingerprint)
      }

      if (data.game_over) {
        console.log("Game over received:", data)
        console.log("data", data);
        setGameState((prevState) => ({
          ...prevState,
          gameOver: true,
          player1Score: data.player1_score,
          player2Score: data.player2_score,
          player1CooperationPercent: data.player1_cooperation,
          player2CooperationPercent: data.player2_cooperation,
        }))
      }

      if (data.error) {
        console.error("Error from server:", data.error)
        alert(data.error)
        return
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

  // Effect to manage the results display duration
  useEffect(() => {
    if (roundPhase === "results") {
      const timer = setTimeout(() => {
        setRoundPhase("choosing")
        setLastRoundResult(null)
        setTimeLeft(10) // Reset timer for the new round
        setCanMakeChoice(true)
      }, 4000) // Show results for 4 seconds

      return () => clearTimeout(timer)
    }
  }, [roundPhase])

  const updateGameState = (newState, fingerprint) => {
    console.log("Updating game state with fingerprint:", fingerprint)
    console.log("New state:", newState)

    setGameState((prev) => {
      // Check if a round has just ended
      if (newState.currentRound > prev.currentRound && !newState.gameOver) {
        const lastRoundData = newState.roundHistory.find((r) => r.roundNumber === prev.currentRound)
        if (lastRoundData) {
          setLastRoundResult({
            player1Action: lastRoundData.player1Action,
            player2Action: lastRoundData.player2Action,
            player1Payoff: lastRoundData.player1Payoff,
            player2Payoff: lastRoundData.player2Payoff,
          })
          setRoundPhase("results")
          setCanMakeChoice(false) // Disable choices during results phase
        }
      }

      const merged = { ...prev, ...newState }
      const iAmP1 = merged.player1Fingerprint === fingerprint

      setIsPlayer1(iAmP1)
      if (roundPhase === "choosing") {
        checkIfWaitingForMyAction(merged, iAmP1)
      } else {
        setWaitingForMyAction(false)
      }
      return merged
    })
  }

  const checkIfWaitingForMyAction = (state, iAmP1) => {
    if (state.waitingForOpponent || state.gameOver) {
      setWaitingForMyAction(false)
      return
    }
    const thisRound = state.roundHistory.find((r) => r.roundNumber === state.currentRound)

    if (!thisRound) {
      setWaitingForMyAction(true)
    } else if (iAmP1) {
      setWaitingForMyAction(thisRound.player1Action == null)
    } else {
      setWaitingForMyAction(thisRound.player2Action == null)
    }

    const myLast = iAmP1 ? state.player1LastAction : state.player2LastAction
    setWaitingForMyAction(myLast == null)
  }

  const handlePlayerAction = (actionPlayerFingerprint, action, myFingerprint) => {
    console.log(`Action from ${actionPlayerFingerprint}, my fingerprint: ${myFingerprint}`)

    if (actionPlayerFingerprint === myFingerprint) {
      setWaitingForMyAction(false)
      setCanMakeChoice(false)
      console.log("My action processed")
    }
  }

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

    if (socketRef.current) {
      socketRef.current.send(
        JSON.stringify({
          action,
          player_fingerprint: myFingerprint,
        }),
      )
    }
  }

  // Handle timeout - send abandon message instead of auto-defect
  const handleTimeout = () => {
    if (!waitingForMyAction || !connected) {
      return
    }

    console.log("Timeout reached - abandoning match")
    
    if (socketRef.current) {
      socketRef.current.send(
        JSON.stringify({
          action: "timeout",
          player_fingerprint: myFingerprint,
        }),
      )
    }
  }

  if (!connected) {
    return (
      <div className="game-page">
        <div className="connecting-screen">
          <div className="connecting-animation">
            <div className="connecting-spinner"></div>
            <h2 className="connecting-title">Connecting to Game Server</h2>
            <p className="connecting-text">Establishing secure connection...</p>
          </div>
        </div>
      </div>
    )
  }

  if (gameState.waitingForOpponent) {
    return (
      <div className="game-page">
        <div className="waiting-screen">
          <div className="waiting-container">
            <div className="waiting-animation">
              <Users className="waiting-icon" />
            </div>
            <h2 className="waiting-title">Waiting for Opponent</h2>
            <p className="waiting-text">
              {gameState.gameMode === "online"
                ? "Please wait while we find another player to join your game..."
                : "Preparing bot opponent..."}
            </p>
            <div className="waiting-info">
              <div className="info-item">
                <span>Match ID:</span>
                <code className="match-id">{matchId}</code>
              </div>
              <div className="info-item">
                <span>Game Mode:</span>
                <span className="game-mode">
                  {gameState.gameMode === "online" ? (
                    <>
                      <Users className="mode-icon" />
                      Online
                    </>
                  ) : (
                    <>
                      <Bot className="mode-icon" />
                      Bot
                    </>
                  )}
                </span>
              </div>
            </div>
            <PayoffMatrix />
          </div>
        </div>
      </div>
    )
  }

  if (gameState.gameOver) {
    const myScore = isPlayer1 ? gameState.player1Score : gameState.player2Score
    const opponentScore = isPlayer1 ? gameState.player2Score : gameState.player1Score
    const isWinner = myScore > opponentScore
    const isTie = myScore === opponentScore

    return (
      <div className="game-page">
        <div className="game-over-screen">
          <div className="game-over-container">
            <div className="game-over-header">
              <div className={`result-icon-container ${isWinner ? "winner" : isTie ? "tie" : "loser"}`}>
                <Trophy className="result-icon" />
              </div>
              <h1 className="game-over-title">{isWinner ? "Victory!" : isTie ? "It's a Tie!" : "Game Over"}</h1>
              <p className="game-over-subtitle">
                {isWinner
                  ? "Congratulations! You outplayed your opponent."
                  : isTie
                    ? "You and your opponent scored equally well."
                    : "Better luck next time! Learn from this experience."}
              </p>
            </div>

            <div className="final-scores-grid">
              <div className={`score-card ${isPlayer1 ? "my-score" : "opponent-score"}`}>
                <div className="score-header">
                  <Target className="score-icon" />
                  <h3>Your Score</h3>
                </div>
                <div className="score-value">{myScore}</div>
                <div className="score-details">
                  <span>25 rounds played</span>
                </div>
              </div>

              <div className={`score-card ${!isPlayer1 ? "my-score" : "opponent-score"}`}>
                <div className="score-header">
                  {gameState.gameMode === "online" ? <Users className="score-icon" /> : <Bot className="score-icon" />}
                  <h3>{gameState.gameMode === "online" ? "Opponent" : "Bot"}</h3>
                </div>
                <div className="score-value">{opponentScore}</div>
                <div className="score-details">
                  <span>25 rounds played</span>
                </div>
              </div>
            </div>

            <div className="game-actions">
              <button className="play-again-button" onClick={() => navigate("/prisoners")}>
                <Zap className="button-icon" />
                Play Again
              </button>
              <button className="menu-button" onClick={() => navigate("/")}>
                <Shield className="button-icon" />
                Main Menu
              </button>
            </div>

            <div className="round-history-section">
              <PayoffsTable history={gameState.roundHistory} />
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="game-page">
      <div className="game-screen">
        <div className="game-header">
          <div className="game-title-section">
            <h1 className="game-title">Prisoner's Dilemma</h1>
            <p className="game-subtitle">
              Round {gameState.currentRound} of {gameState.maxRounds}
            </p>
          </div>

          <div className="game-status">
            <div className="player-info">
              <span className="player-label">You are Player {isPlayer1 ? "1" : "2"}</span>
              <div className="game-mode-indicator">
                {gameState.gameMode === "online" ? (
                  <>
                    <Users className="mode-icon" />
                    Online
                  </>
                ) : (
                  <>
                    <Bot className="mode-icon" />
                    vs Bot
                  </>
                )}
              </div>
            </div>

            <div className="action-status">
              {waitingForMyAction ? (
                <div className="status-active">
                  <Zap className="status-icon" />
                  Your turn to choose!
                </div>
              ) : (
                <div className="status-waiting">
                  <Clock className="status-icon" />
                  Waiting for opponent...
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="game-content">
          <div className="game-main">
            {roundPhase === "choosing" ? (
              <div className="timer-section">
                <GameTimer
                  timeLeft={timeLeft}
                  setTimeLeft={setTimeLeft}
                  canMakeChoice={canMakeChoice && waitingForMyAction}
                  onTimeUp={handleTimeout} // Changed: now calls handleTimeout instead of auto-defect
                />
              </div>
            ) : (
              <div className="timer-section results-display">
                <Trophy className="results-icon" />
                <h4>Round {gameState.currentRound > 1 ? gameState.currentRound - 1 : 1} Results</h4>
              </div>
            )}

            <div className="scores-section">
              <div className="score-card player1">
                <div className="score-header">
                  <Target className="score-icon" />
                  <h3>Player 1</h3>
                </div>
                <div className="score-value">
                  {roundPhase === "results" && lastRoundResult ? (
                    <span className="round-gain">+{gameState.roundHistory[gameState.roundHistory.length - 1].player1Points}</span>
                  ) : gameState.roundHistory.length > 0 ? (
                    gameState.roundHistory[gameState.roundHistory.length - 1].player1Points || 
                    gameState.roundHistory[gameState.roundHistory.length - 1].player1Payoff || 0
                  ) : (
                    gameState.player1Score
                  )}
                </div>
                <div className="score-label">
                  {roundPhase === "results" ? "Round Gain" : gameState.roundHistory.length > 0 ? "Current Round" : "Total Score"}
                </div>
              </div>

              <div className="score-card player2">
                <div className="score-header">
                  {gameState.gameMode === "online" ? <Users className="score-icon" /> : <Bot className="score-icon" />}
                  <h3>Player 2</h3>
                </div>
                <div className="score-value">
                  {roundPhase === "results" && lastRoundResult ? (
                    <span className="round-gain">+{gameState.roundHistory[gameState.roundHistory.length - 1].player2Points}</span>
                  ) : gameState.roundHistory.length > 0 ? (
                    gameState.roundHistory[gameState.roundHistory.length - 1].player2Points || 
                    gameState.roundHistory[gameState.roundHistory.length - 1].player2Payoff || 0
                  ) : (
                    gameState.player2Score
                  )}
                </div>
                <div className="score-label">
                  {roundPhase === "results" ? "Round Gain" : gameState.roundHistory.length > 0 ? "Current Round" : "Total Score"}
                </div>
              </div>
            </div>

            <div className="action-section">
              <h3 className="action-title">{roundPhase === "choosing" ? "Make Your Choice" : "Round Over"}</h3>
              <div className="action-buttons">
                <button
                  className={`action-button cooperate-button ${
                    !canMakeChoice || !waitingForMyAction || roundPhase !== "choosing" ? "disabled" : ""
                  }`}
                  onClick={() => makeChoice("Cooperate")}
                  disabled={!canMakeChoice || !waitingForMyAction || roundPhase !== "choosing"}
                >
                  <Shield className="button-icon" />
                  Cooperate
                </button>
                <button
                  className={`action-button defect-button ${
                    !canMakeChoice || !waitingForMyAction || roundPhase !== "choosing" ? "disabled" : ""
                  }`}
                  onClick={() => makeChoice("Defect")}
                  disabled={!canMakeChoice || !waitingForMyAction || roundPhase !== "choosing"}
                >
                  <Zap className="button-icon" />
                  Defect
                </button>
              </div>
            </div>
          </div>

          <div className="game-sidebar">
            <PayoffMatrix highlightedCell={lastRoundResult} />

            <div className="round-progress">
              <h3 className="progress-title">Round Progress</h3>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${(gameState.currentRound / gameState.maxRounds) * 100}%` }}
                ></div>
              </div>
              <div className="progress-text">
                {gameState.currentRound} / {gameState.maxRounds} rounds
              </div>
            </div>
          </div>
        </div>

        <div className="round-history-section">
          <PayoffsTable history={gameState.roundHistory} />
        </div>
      </div>

      <Modal
        open={modal.open}
        title={modal.title}
        message={modal.msg}
        onClose={() => {
          setModal({ open: false })
          navigate("/prisoners")
        }}
      />
    </div>
  )
}

export default GameBoard