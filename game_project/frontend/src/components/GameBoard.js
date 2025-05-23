"use client"

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
    lastAction: null,
    opponentLastAction: null,
  })
  const [timeLeft, setTimeLeft] = useState(10)
  const [canMakeChoice, setCanMakeChoice] = useState(true)
  const [waitingForPlayer, setWaitingForPlayer] = useState(true)
  const socketRef = useRef(null)

  // Connect to WebSocket
  useEffect(() => {
    if (!matchId) {
      navigate("/")
      return
    }

    // Get the fingerprint from localStorage if not provided
    const fingerprint = playerFingerprint || localStorage.getItem("playerFingerprint")
    if (!fingerprint) {
      navigate("/")
      return
    }

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
      const data = JSON.parse(event.data);

      if (data.game_over) {
        navigate(`/results/${matchId}`);
        return;
      }
      console.log("WebSocket message received:", data)

      // Handle different message types
      if (data.player_fingerprint && data.action) {
        if (data.action === "join" && data.player_fingerprint !== fingerprint) {
          setWaitingForPlayer(false)
        } else if (data.player_fingerprint !== fingerprint) {
          handleOpponentAction(data.player_fingerprint, data.action)
        }
      }

      if (data.game_state) {
        updateGameState(data.game_state)
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

  // Handle opponent's action
  const handleOpponentAction = (opponentFingerprint, action) => {
    if (opponentFingerprint !== playerFingerprint) {
      setGameState((prevState) => ({
        ...prevState,
        opponentLastAction: action,
        waitingForOpponent: false,
      }))

      // If player has already made a choice, calculate round results
      if (gameState.lastAction) {
        calculateRoundResults(gameState.lastAction, action)
      }
    }
  }

  // Update game state from server
  const updateGameState = (newState) => {
    setGameState((prevState) => ({
      ...prevState,
      ...newState,
    }))
  }

  // Calculate round results
  const calculateRoundResults = (playerAction, opponentAction) => {
    let player1Points = 0
    let player2Points = 0

    if (playerAction === "Cooperate" && opponentAction === "Cooperate") {
      player1Points = 20
      player2Points = 20
    } else if (playerAction === "Cooperate" && opponentAction === "Defect") {
      player1Points = 0
      player2Points = 30
    } else if (playerAction === "Defect" && opponentAction === "Cooperate") {
      player1Points = 30
      player2Points = 0
    } else if (playerAction === "Defect" && opponentAction === "Defect") {
      player1Points = 10
      player2Points = 10
    }

    const newRound = {
      roundNumber: gameState.currentRound,
      playerAction,
      opponentAction,
      playerPoints: player1Points,
      opponentPoints: player2Points,
    }

    setGameState((prevState) => ({
      ...prevState,
      player1Score: prevState.player1Score + player1Points,
      player2Score: prevState.player2Score + player2Points,
      roundHistory: [...prevState.roundHistory, newRound],
      currentRound: prevState.currentRound + 1,
      waitingForOpponent: true,
      lastAction: null,
      opponentLastAction: null,
      gameOver: prevState.currentRound >= prevState.maxRounds,
    }))

    // Reset for next round
    setCanMakeChoice(true)
    setTimeLeft(10)
  }

  // Make a choice (Cooperate or Defect)
  const makeChoice = (action) => {
    if (!canMakeChoice || !connected || waitingForPlayer) return

    setCanMakeChoice(false)
    setGameState((prevState) => ({
      ...prevState,
      lastAction: action,
    }))

    // Send action to server
    if (socketRef.current) {
      socketRef.current.send(
        JSON.stringify({
          action,
          player_fingerprint: playerFingerprint || localStorage.getItem("playerFingerprint"),
        }),
      )
    }

    // If opponent has already made a choice, calculate round results
    if (gameState.opponentLastAction) {
      calculateRoundResults(action, gameState.opponentLastAction)
    }
  }

  // Calculate cooperation percentages
  const calculateCooperationPercent = (history, isPlayer) => {
    if (history.length === 0) return 0

    const cooperationCount = history.filter((round) =>
      isPlayer ? round.playerAction === "Cooperate" : round.opponentAction === "Cooperate",
    ).length

    return Math.round((cooperationCount / history.length) * 100)
  }

  // Update cooperation percentages
  useEffect(() => {
    const player1Percent = calculateCooperationPercent(gameState.roundHistory, true)
    const player2Percent = calculateCooperationPercent(gameState.roundHistory, false)

    setGameState((prevState) => ({
      ...prevState,
      player1CooperationPercent: player1Percent,
      player2CooperationPercent: player2Percent,
    }))
  }, [gameState.roundHistory])

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
    <div className="game-board">
      <div className="game-status">
        {!connected ? (
          <div className="connecting">Connecting to game server...</div>
        ) : waitingForPlayer ? (
          <div className="waiting-for-player">
            <h3>Waiting for opponent to join...</h3>
            <p>Share this match ID with your opponent:</p>
            <div className="match-id-container">
              <code>{matchId}</code>
              <button className="copy-button" onClick={shareMatchId}>
                Copy
              </button>
            </div>
          </div>
        ) : gameState.gameOver ? (
          <div className="game-over">
            <h2>Game Over</h2>
            <p>Your final score: {gameState.player1Score}</p>
            <p>Opponent's final score: {gameState.player2Score}</p>
            <p>Your cooperation rate: {gameState.player1CooperationPercent}%</p>
            <p>Opponent's cooperation rate: {gameState.player2CooperationPercent}%</p>
            <button onClick={() => navigate("/")}>Play Again</button>
          </div>
        ) : (
          <>
            <div className="round-info">
              <h3>
                Round {gameState.currentRound} of {gameState.maxRounds}
              </h3>
              {gameState.waitingForOpponent && gameState.lastAction ? (
                <p>Waiting for opponent...</p>
              ) : (
                <p>Make your choice</p>
              )}
            </div>

            <div className="timer-container">
              <GameTimer
                timeLeft={timeLeft}
                setTimeLeft={setTimeLeft}
                canMakeChoice={canMakeChoice && !gameState.waitingForOpponent}
                onTimeUp={() => !gameState.lastAction && makeChoice("Defect")}
              />
            </div>

            <div className="scores">
              <div className="score-box">
                <h4>Your Score</h4>
                <p>{gameState.player1Score}</p>
                <p className="cooperation-rate">Cooperation: {gameState.player1CooperationPercent}%</p>
              </div>
              <div className="score-box">
                <h4>Opponent's Score</h4>
                <p>{gameState.player2Score}</p>
                <p className="cooperation-rate">Cooperation: {gameState.player2CooperationPercent}%</p>
              </div>
            </div>

            <div className="action-buttons">
              <button
                className={`cooperate-button ${!canMakeChoice || gameState.waitingForOpponent ? "disabled" : ""}`}
                onClick={() => makeChoice("Cooperate")}
                disabled={!canMakeChoice || gameState.waitingForOpponent}
              >
                Cooperate
              </button>
              <button
                className={`defect-button ${!canMakeChoice || gameState.waitingForOpponent ? "disabled" : ""}`}
                onClick={() => makeChoice("Defect")}
                disabled={!canMakeChoice || gameState.waitingForOpponent}
              >
                Defect
              </button>
            </div>
          </>
        )}
      </div>

      <div className="game-info">
        <PayoffMatrix />
        <RoundHistory history={gameState.roundHistory} />
      </div>
    </div>
  )
}

export default GameBoard
