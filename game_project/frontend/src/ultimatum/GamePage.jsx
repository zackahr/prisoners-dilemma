import { useState, useEffect, useCallback } from "react"
import {
  Clock,
  DollarSign,
  CheckCircle,
  XCircle,
  Wifi,
  WifiOff,
  Loader2,
} from "lucide-react"
import { useNavigate, useSearchParams } from "react-router-dom"

import PayoffsTable from "./PayoffsTable"
import { useWebSocket } from "../hooks/useWebSocket"
import { gameApi, getPlayerFingerprint } from "../services/gameApi"
import "./GamePage.css"

const MAX_ROUNDS = 25
const TOTAL_MONEY = 100

export default function GamePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // Read "mode" and "match" from the URL
  const gameMode = searchParams.get("mode") || "online"
  const urlMatchId = searchParams.get("match") || null

  // FIXED: Use the same fingerprint function as matchmaking
  const [playerFingerprint] = useState(() => getPlayerFingerprint())

  // matchId starts as the URL param (if any), otherwise null
  const [matchId, setMatchId] = useState(urlMatchId)
  const [isInitializing, setIsInitializing] = useState(true)

  // Game‐state + timing
  const [inputOffer, setInputOffer] = useState("")
  const [timeLeft, setTimeLeft] = useState(30)
  const [currentPhase, setCurrentPhase] = useState("waiting") // "waiting" | "proposing" | "responding" | "result"

  // Hook that manages WebSocket connection (only opens once matchId is set)
  const { gameState, connectionStatus, error, sendMessage } =
    useWebSocket(matchId, playerFingerprint)

  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const initializeMatch = async () => {
      // 1) If URL already has a match ID, skip createMatch entirely
      if (urlMatchId) {
        console.log("🔗 Using existing match from URL:", urlMatchId)
        console.log("👤 Using fingerprint:", playerFingerprint)
        setMatchId(urlMatchId)
        setIsInitializing(false)
        return
      }

      // 2) Otherwise, no match param: call createMatch(...) to make/join a new one
      try {
        console.log("🚀 Initializing new match with mode:", gameMode)
        console.log("👤 Using fingerprint:", playerFingerprint)
        const matchData = await gameApi.createMatch(gameMode, playerFingerprint)
        console.log("✅ Match initialized:", matchData.match_id)
        setMatchId(matchData.match_id)
      } catch (err) {
        console.error("❌ Failed to initialize match:", err)
      } finally {
        setIsInitializing(false)
      }
    }

    initializeMatch()
  }, [gameMode, playerFingerprint, urlMatchId])

  // Whenever gameState updates, decide which phase we're in
  useEffect(() => {
    if (!gameState) return

    console.log("🎮 Processing game state update:", gameState)

    if (gameState.gameOver) {
      setCurrentPhase("result")
      return
    }

    if (gameState.waitingForOpponent) {
      setCurrentPhase("waiting")
      return
    }

    const currentRound = gameState.currentRoundState
    if (!currentRound) return

    const isMyTurnToPropose =
      currentRound.proposerFingerprint === playerFingerprint
    const isMyTurnToRespond =
      currentRound.responderFingerprint === playerFingerprint

    console.log("🎯 Turn analysis:", {
      isMyTurnToPropose,
      isMyTurnToRespond,
      proposerFingerprint: currentRound.proposerFingerprint,
      responderFingerprint: currentRound.responderFingerprint,
      myFingerprint: playerFingerprint,
      offerMade: currentRound.offerMade,
      responseMade: currentRound.responseMade,
    })

    if (isMyTurnToPropose && !currentRound.offerMade) {
      setCurrentPhase("proposing")
      setTimeLeft(30)
    } else if (
      isMyTurnToRespond &&
      currentRound.offerMade &&
      !currentRound.responseMade
    ) {
      setCurrentPhase("responding")
      setTimeLeft(30)
    } else {
      setCurrentPhase("waiting")
      setTimeLeft(15)
    }
  }, [gameState, playerFingerprint])

  // Timer countdown for proposing/responding
  useEffect(() => {
    if (
      timeLeft <= 0 ||
      currentPhase === "waiting" ||
      currentPhase === "result"
    )
      return

    const timer = setTimeout(() => {
      setTimeLeft((prev) => prev - 1)
    }, 1000)
    return () => clearTimeout(timer)
  }, [timeLeft, currentPhase])

  // "Make offer" callback
  const submitOffer = useCallback(() => {
    const offer = Math.max(0, Math.min(+inputOffer || 0, TOTAL_MONEY))
    console.log("💰 Submitting offer:", offer)

    const success = sendMessage({
      action: "make_offer",
      player_fingerprint: playerFingerprint,
      offer: offer,
    })

    if (success) {
      setInputOffer("")
      setCurrentPhase("waiting")
    }
  }, [inputOffer, sendMessage, playerFingerprint])

  // "Respond to offer" callback
  const respondToOffer = useCallback(
    (accept) => {
      const response = accept ? "accept" : "reject"
      console.log("🤔 Responding to offer:", response)

      const success = sendMessage({
        action: "respond_to_offer",
        player_fingerprint: playerFingerprint,
        response: response,
      })

      if (success) {
        setCurrentPhase("waiting")
      }
    },
    [sendMessage, playerFingerprint]
  )

  // ─── Rendering ───────────────────────────────────────────────────────────────

  // 1) Show loading spinner while initializing (or waiting for matchId)
  if (isInitializing || !matchId) {
    return (
      <div className="game-page">
        <div className="game-container">
          <div className="loading-section">
            <Loader2 className="loading-spinner" />
            <p>Initializing game…</p>
          </div>
        </div>
      </div>
    )
  }

  // 2) Connection error (e.g. WS refused)
  if (error) {
    return (
      <div className="game-page">
        <div className="game-container">
          <div className="error-section">
            <XCircle className="error-icon" />
            <h2>Connection Error</h2>
            <p>{error}</p>
            <div className="debug-info">
              <p><strong>Your fingerprint:</strong> {playerFingerprint}</p>
              <p><strong>Match ID:</strong> {matchId}</p>
              {gameState && (
                <>
                  <p><strong>Player 1:</strong> {gameState.player1Fingerprint}</p>
                  <p><strong>Player 2:</strong> {gameState.player2Fingerprint}</p>
                </>
              )}
            </div>
            <button
              onClick={() => navigate("/ultimatum")}
              className="menu-button"
            >
              Back to Menu
            </button>
          </div>
        </div>
      </div>
    )
  }

  // 3) Game over screen
  if (currentPhase === "result" && gameState?.gameOver) {
    return (
      <div className="game-over-page">
        <div className="game-over-container">
          <div className="game-over-header">
            <h1 className="game-over-title">Game Complete!</h1>
            <p>All {MAX_ROUNDS} rounds finished</p>
          </div>

          <div className="final-scores">
            <div className="score-card">
              <h3>Final Scores</h3>
              <div className="scores">
                <div className="score-item">
                  <span>Player 1:</span>
                  <span>${gameState.player1Score}</span>
                </div>
                <div className="score-item">
                  <span>Player 2:</span>
                  <span>${gameState.player2Score}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="action-buttons">
            <button
              onClick={() => navigate("/ultimatum")}
              className="menu-button"
            >
              Back to Menu
            </button>
          </div>

          <PayoffsTable history={gameState.roundHistory || []} />
        </div>
      </div>
    )
  }

  // 4) Main game interface
  return (
    <div className="game-page">
      <div className="game-container">
        {/* Connection status badge */}
        <div className="connection-status">
          {connectionStatus === "connected" ? (
            <>
              <Wifi className="connection-icon connected" /> Connected
            </>
          ) : connectionStatus === "connecting" ? (
            <>
              <Loader2 className="connection-icon connecting" /> Connecting
            </>
          ) : (
            <>
              <WifiOff className="connection-icon disconnected" /> Disconnected
            </>
          )}
        </div>

        {/* Game header */}
        <div className="game-header">
          <h1 className="game-title">Ultimatum Game</h1>
          <p className="game-subtitle">
            Round {gameState?.currentRound || 1} of {MAX_ROUNDS}
          </p>
          <p className="match-id">Match ID: {matchId}</p>
          <p className="player-id">Your ID: {playerFingerprint}</p>
        </div>

        {/* Main card (money display + phases) */}
        <div className="game-board">
          <div className="game-card">
            <div className="game-card-header">
              <div className="timer">
                <Clock className="timer-icon" />
                <span>{timeLeft}s</span>
              </div>
              <h2 className="phase-title">
                {currentPhase === "proposing" && "MAKE YOUR OFFER"}
                {currentPhase === "responding" && "RESPOND TO OFFER"}
                {currentPhase === "waiting" && "WAITING…"}
              </h2>
            </div>

            <div className="game-card-content">
              <div className="money-display">
                <div className="money-content">
                  <DollarSign className="money-icon" />
                  <span>{TOTAL_MONEY}</span>
                </div>
              </div>

              {/* Waiting for opponent to join (initial round) */}
              {gameState?.waitingForOpponent && (
                <div className="waiting-section">
                  <div className="waiting-animation">
                    <Loader2 className="waiting-spinner" />
                    <p className="waiting-text">
                      Waiting for opponent to join…
                    </p>
                  </div>
                </div>
              )}

              {/* Proposing phase */}
              {currentPhase === "proposing" && (
                <>
                  <p className="offer-label">
                    How much will you offer your opponent?
                  </p>
                  <div className="offer-input-container">
                    <input
                      type="number"
                      value={inputOffer}
                      onChange={(e) => setInputOffer(e.target.value)}
                      min="0"
                      max={TOTAL_MONEY}
                      placeholder="0"
                      className="offer-input"
                    />
                    <div className="dollar-sign">$</div>
                  </div>
                  <button
                    onClick={submitOffer}
                    disabled={
                      !inputOffer || +inputOffer < 0 || +inputOffer > TOTAL_MONEY
                    }
                    className="submit-button"
                  >
                    SUBMIT OFFER
                  </button>
                </>
              )}

              {/* Responding phase */}
              {currentPhase === "responding" &&
                gameState?.currentRoundState && (
                  <div className="responding-section">
                    <div className="offer-display">
                      <p className="offer-label">Opponent offers you:</p>
                      <p className="offer-amount-large">
                        ${gameState.currentRoundState.offer}
                      </p>
                    </div>

                    <div className="decision-info">
                      <p className="keep-amount">
                        If you accept: You get $
                        {gameState.currentRoundState.offer}
                      </p>
                      <p className="keep-amount">If you reject: You get $0</p>
                    </div>

                    <div className="response-buttons">
                      <button
                        onClick={() => respondToOffer(true)}
                        className="accept-button"
                      >
                        <CheckCircle className="button-icon" />
                        ACCEPT
                      </button>
                      <button
                        onClick={() => respondToOffer(false)}
                        className="reject-button"
                      >
                        <XCircle className="button-icon" />
                        REJECT
                      </button>
                    </div>
                  </div>
                )}

              {/* Waiting phase (after either offer or response) */}
              {currentPhase === "waiting" && !gameState?.waitingForOpponent && (
                <div className="waiting-section">
                  <div className="waiting-animation">
                    <Loader2 className="waiting-spinner" />
                    <p className="waiting-text">
                      {gameState?.currentRoundState?.offerMade &&
                      !gameState?.currentRoundState?.responseMade
                        ? "Waiting for opponent's response…"
                        : "Waiting for opponent's offer…"}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Scores */}
        {gameState && (
          <div className="scores-section">
            <div className="score-item">
              <span>Your Score:</span>
              <span>
                $
                {gameState.player1Fingerprint === playerFingerprint
                  ? gameState.player1Score
                  : gameState.player2Score}
              </span>
            </div>
            <div className="score-item">
              <span>Opponent Score:</span>
              <span>
                $
                {gameState.player1Fingerprint === playerFingerprint
                  ? gameState.player2Score
                  : gameState.player1Score}
              </span>
            </div>
          </div>
        )}

        {/* Payoffs/history table */}
        <div className="payoffs-area">
          <PayoffsTable history={gameState?.roundHistory || []} />
        </div>
      </div>
    </div>
  )
}