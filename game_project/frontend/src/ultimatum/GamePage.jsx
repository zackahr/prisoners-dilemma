
import { useState, useEffect, useCallback } from "react"
import {
  Clock,
  DollarSign,
  CheckCircle,
  XCircle,
  Wifi,
  WifiOff,
  Loader2,
  AlertTriangle,
} from "lucide-react"
import { useNavigate, useSearchParams } from "react-router-dom"

import PayoffsTable from "./PayoffsTable"
import { useWebSocket } from "../hooks/useWebSocket"
import { gameApi, getPlayerFingerprint } from "../services/gameApi"
import "./GamePage.css"

const MAX_ROUNDS = 25
const TOTAL_MONEY = 100
const OFFER_TIME_LIMIT = 25

export default function GamePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const gameMode = searchParams.get("mode") || "online"
  const urlMatchId = searchParams.get("match") || null

  const [playerFingerprint] = useState(() => getPlayerFingerprint())
  const [matchId, setMatchId] = useState(urlMatchId)
  const [isInitializing, setIsInitializing] = useState(true)

  // Game state for simultaneous play - UPDATED to use coins_to_offer
  const [inputOffer, setInputOffer] = useState("")
  const [timeLeft, setTimeLeft] = useState(OFFER_TIME_LIMIT)
  const [currentPhase, setCurrentPhase] = useState("waiting") // "waiting" | "offering" | "responding" | "result"
  
  // Timeout popup state
  const [showTimeoutPopup, setShowTimeoutPopup] = useState(false)
  const [timeoutCountdown, setTimeoutCountdown] = useState(5)

  const {
    gameState, connectionStatus, error,
    matchTerminated, terminationReason,
    sendMessage, disconnect
  } = useWebSocket(matchId, playerFingerprint);

  useEffect(() => {
    const initializeMatch = async () => {
      if (urlMatchId) {
        console.log("🔗 Using existing match from URL:", urlMatchId)
        console.log("👤 Using fingerprint:", playerFingerprint)
        setMatchId(urlMatchId)
        setIsInitializing(false)
        return
      }

      // QUICK FIX: Bypass API for bot mode
      if (gameMode === "bot") {
        const { match_id } = await gameApi.createMatch("bot", playerFingerprint);
        setMatchId(match_id);
        setIsInitializing(false);
        return;
      }

      try {
        console.log("🚀 Initializing new match with mode:", gameMode)
        console.log("👤 Using fingerprint:", playerFingerprint)
        const matchData = await gameApi.createMatch(gameMode, playerFingerprint)
        console.log("✅ Match initialized:", matchData.match_id)
        setMatchId(matchData.match_id)
      } catch (err) {
        console.error("❌ Failed to initialize match:", err)
        
        // FALLBACK: Create a temporary match ID
        const fallbackMatchId = `fallback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        console.log("🔄 Using fallback match ID:", fallbackMatchId)
        setMatchId(fallbackMatchId)
      } finally {
        setIsInitializing(false)
      }
    }

    initializeMatch()
  }, [gameMode, playerFingerprint, urlMatchId])
  // Handle match termination
  useEffect(() => {
    if (matchTerminated) {
      const t = setTimeout(() => navigate("/ultimatum"), 2000);
      return () => clearTimeout(t);
    }
  }, [matchTerminated, navigate]);

  // Determine current phase based on game state
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
    if (!currentRound) {
      // First frame of a fresh round → make my offer
      setCurrentPhase("offering")
      setTimeLeft(OFFER_TIME_LIMIT)
      return
    }

    const isPlayer1 = gameState.player1Fingerprint === playerFingerprint
    const isPlayer2 = gameState.player2Fingerprint === playerFingerprint

    // Determine what the current player needs to do
    const myOfferMade = isPlayer1 ? currentRound.player1OfferMade : currentRound.player2OfferMade
    const myResponseMade = isPlayer1 ? currentRound.player1ResponseMade : currentRound.player2ResponseMade
    const opponentOfferMade = isPlayer1 ? currentRound.player2OfferMade : currentRound.player1OfferMade
    const bothOffersMade = currentRound.player1OfferMade && currentRound.player2OfferMade

    console.log("🎯 Phase analysis:", {
      isPlayer1,
      isPlayer2,
      myOfferMade,
      myResponseMade,
      opponentOfferMade,
      bothOffersMade,
      currentRound
    })

    // Priority 1 – make my offer
    if (!myOfferMade) {
      setCurrentPhase("offering")
      setTimeLeft(OFFER_TIME_LIMIT)
      return
    }

    // Priority 2 – respond to opponent
    if (bothOffersMade && !myResponseMade) {
      setCurrentPhase("responding")
      setTimeLeft(OFFER_TIME_LIMIT)
      return
    }
    // Priority 3: Otherwise, I'm waiting
    console.log("🎯 Setting phase to waiting - all my actions complete")
    setCurrentPhase("waiting")
    setTimeLeft(15)
  }, [gameState, playerFingerprint])

  // Handle timeout navigation with popup
  useEffect(() => {
    if (timeLeft <= 0 &&
        (currentPhase === "offering" || currentPhase === "responding")) {
      console.log("⏰ Time's up! Showing timeout popup")
      setShowTimeoutPopup(true)
      setTimeoutCountdown(5)
    }
  }, [timeLeft, currentPhase]);
  useEffect(() => {
    // const handlePop = () => disconnect();     // browser back-button
      const handlePop = () => {                 // browser back-button
        disconnect();                           // close WS  notify server
        navigate("/ultimatum", { replace: true });
      };
    const handleUnload = () => disconnect();  // tab closing / reload
    window.addEventListener("popstate", handlePop);
    window.addEventListener("beforeunload", handleUnload);
    return () => {
      window.removeEventListener("popstate", handlePop);
      window.removeEventListener("beforeunload", handleUnload);
    };
  }, [disconnect]);
  // Handle timeout popup countdown
  useEffect(() => {
    if (!showTimeoutPopup) return

    if (timeoutCountdown <= 0) {
      console.log("⏰ Redirecting to /ultimatum")
      disconnect();
      navigate("/ultimatum")
      return
    }

    const timer = setTimeout(() => {
      setTimeoutCountdown(prev => prev - 1)
    }, 1000)

    return () => clearTimeout(timer)
  }, [showTimeoutPopup, timeoutCountdown, navigate])

  // Timer countdown
  useEffect(() => {
    if (timeLeft <= 0 || currentPhase === "waiting" || currentPhase === "result") return

    const timer = setTimeout(() => {
      setTimeLeft((prev) => prev - 1)
    }, 1000)
    return () => clearTimeout(timer)
  }, [timeLeft, currentPhase])

  // Submit offer - UPDATED to send coins_to_keep and coins_to_offer
  const submitOffer = useCallback(() => {
    const coinsToOffer = Math.max(0, Math.min(+inputOffer || 0, TOTAL_MONEY))
    const coinsToKeep = TOTAL_MONEY - coinsToOffer
    
    console.log("💰 Submitting offer:", {
      coinsToKeep,
      coinsToOffer,
      total: coinsToKeep + coinsToOffer
    })

    const success = sendMessage({
      action: "make_offer",
      player_fingerprint: playerFingerprint,
      coins_to_keep: coinsToKeep,
      coins_to_offer: coinsToOffer,
    })

    if (success) {
      setInputOffer("")
    }
  }, [inputOffer, sendMessage, playerFingerprint])

  // Respond to offers
  const respondToPlayer = useCallback((targetPlayer, accept) => {
    const response = accept ? "accept" : "reject"
    console.log(`🤔 Responding ${response} to ${targetPlayer}`)

    const success = sendMessage({
      action: "respond_to_offer",
      player_fingerprint: playerFingerprint,
      target_player: targetPlayer,
      response: response,
    })

    return success
  }, [sendMessage, playerFingerprint])

  // Helper to get current player info
  const isPlayer1 = gameState?.player1Fingerprint === playerFingerprint
  const isPlayer2 = gameState?.player2Fingerprint === playerFingerprint

  // Timeout Popup Component
  const TimeoutPopup = () => {
    if (!showTimeoutPopup) return null

    return (
      <div className="timeout-popup-overlay">
        <div className="timeout-popup">
          <div className="timeout-popup-content">
            <AlertTriangle className="timeout-icon" />
            <h2 className="timeout-title">Time's Up!</h2>
            <p className="timeout-message">
              The 25 seconds have passed. You will be redirected to the menu.
            </p>
            <div className="timeout-countdown">
              <div className="countdown-circle">
                <span className="countdown-number">{timeoutCountdown}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Handle match termination UI
  if (matchTerminated) {
    return (
      <div className="game-page">
        <div className="game-container">
          <div className="error-section">
            <XCircle className="error-icon" />
            <h2>Opponent Disconnected</h2>
            <p>
              {terminationReason === "timeout"
                ? "Your opponent ran out of time."
                : "Your opponent left the match."}
            </p>
            <p>You'll be returned to the menu…</p>
          </div>
        </div>
      </div>
    );
  }

  // Show loading spinner
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

  // Connection error
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
                  <p><strong>Game Mode:</strong> {gameState.gameMode}</p>
                  <p><strong>Current Round:</strong> {gameState.currentRound}</p>
                  <p><strong>Waiting for Opponent:</strong> {gameState.waitingForOpponent ? "Yes" : "No"}</p>
                  {gameState.currentRoundState && (
                    <>
                      <p><strong>P1 Offer Made:</strong> {gameState.currentRoundState.player1OfferMade ? "Yes" : "No"}</p>
                      <p><strong>P2 Offer Made:</strong> {gameState.currentRoundState.player2OfferMade ? "Yes" : "No"}</p>
                    </>
                  )}
                </>
              )}
            </div>
            <button onClick={() => {
                disconnect();
                navigate("/ultimatum");
              }} className="menu-button">
              Back to Menu
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Game over screen
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
                <div className="score-item">
                  <span>Your Score:</span>
                  <span>${isPlayer1 ? gameState.player1Score : gameState.player2Score}</span>
                </div>
                <div className="score-item">
                  <span>Opponent Score:</span>
                  <span>${isPlayer1 ? gameState.player2Score : gameState.player1Score}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="action-buttons">
            <button onClick={() => { disconnect(); navigate("/ultimatum"); }} className="menu-button">
              Back to Menu
            </button>
          </div>

          {/* <PayoffsTable history={gameState.roundHistory || []} /> */}
        </div>
      </div>
    )
  }

  // Main game interface
  return (
    <div className="game-page">
      <TimeoutPopup />
      <div className="game-container">
        {/* Connection status */}
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
          <h1 className="game-title simultaneous">Ultimatum Game </h1>
          <p className="game-subtitle">
            Round {gameState?.currentRound || 1} of {MAX_ROUNDS}
          </p>
          <p className="match-id">Match ID: {matchId}</p>
          <p className="player-id">You are: {isPlayer1 ? "Player 1" : isPlayer2 ? "Player 2" : "Unknown"}</p>
        </div>

        {/* Main game card */}
        <div className="game-board">
          <div className="game-card">
            <div className="game-card-header">
              <div className="timer">
                <Clock className="timer-icon" />
                <span>{timeLeft}s</span>
              </div>
              <h2 className="phase-title">
                {currentPhase === "offering" && "MAKE YOUR OFFER"}
                {currentPhase === "responding" && "RESPOND TO OFFERS"}
                {currentPhase === "waiting" && "WAITING…"}
                {currentPhase === "result" && "GAME COMPLETE"}
              </h2>
            </div>

            <div className="game-card-content">
              <div className="money-display">
                <div className="money-content">
                  <DollarSign className="money-icon" />
                  <span>{TOTAL_MONEY}</span>
                </div>
              </div>

              {/* Waiting for opponent to join */}
              {gameState?.waitingForOpponent && (
                <div className="waiting-section">
                  <div className="waiting-animation">
                    <Loader2 className="waiting-spinner" />
                    <p className="waiting-text">Waiting for opponent to join…</p>
                  </div>
                  <div className="debug-info">
                    <p><strong>Match ID:</strong> {matchId}</p>
                    <p><strong>Game Mode:</strong> {gameState.gameMode}</p>
                    <p><strong>Player 1:</strong> {gameState.player1Fingerprint || "None"}</p>
                    <p><strong>Player 2:</strong> {gameState.player2Fingerprint || "None"}</p>
                  </div>
                </div>
              )}

              {/* Offering phase - UPDATED to show coins breakdown */}
              {currentPhase === "offering" && !gameState?.waitingForOpponent && (
                <div className="offer-section">
                  <p className="offer-label">How much will you offer your opponent?</p>
                  <div className="offer-breakdown">
                    <p className="breakdown-text">
                      You offer: <strong>${inputOffer || 0}</strong> | 
                      You keep: <strong>${TOTAL_MONEY - (+inputOffer || 0)}</strong>
                    </p>
                  </div>
                  <div className="offer-input-container">
                    <input
                      type="number"
                      value={inputOffer}
                      onChange={(e) => {
                        const value = e.target.value;
                        // Allow empty string for clearing the input
                        if (value === '') {
                          setInputOffer('');
                          return;
                        }
                        
                        // Convert to number and validate
                        const numValue = Number(value);
                        
                        // Only allow values between 0 and TOTAL_MONEY (100)
                        if (!isNaN(numValue) && numValue >= 0 && numValue <= TOTAL_MONEY) {
                          setInputOffer(value);
                        }
                        // If value is greater than TOTAL_MONEY, set it to TOTAL_MONEY
                        else if (!isNaN(numValue) && numValue > TOTAL_MONEY) {
                          setInputOffer(TOTAL_MONEY.toString());
                        }
                      }}
                      min="0"
                      max={TOTAL_MONEY}
                      step="1"
                      placeholder="0"
                      className="offer-input"
                      autoFocus
                      onKeyDown={(e) => {
                        // Prevent entering 'e', 'E', '+', '-' which are valid in number inputs but not wanted here
                        if (['e', 'E', '+', '-'].includes(e.key)) {
                          e.preventDefault();
                        }
                      }}
                    />
                    <div className="dollar-sign">$</div>
                  </div>
                  <button
                    onClick={submitOffer}
                    disabled={!inputOffer || +inputOffer < 0 || +inputOffer > TOTAL_MONEY}
                    className="submit-button"
                  >
                    SUBMIT OFFER
                  </button>
                </div>
              )}

              {/* Responding phase - UPDATED to show new logic */}
              {currentPhase === "responding" && gameState?.currentRoundState && (
                <div className="responding-section">
                  <h3>Respond to Offers:</h3>
                  
                  {/* Response to opponent's offer - UPDATED */}
                  {isPlayer1 && gameState.currentRoundState.player2CoinsToOffer !== null && (
                    <div className="offer-response-card">
                      <div className="offer-display">
                        <p className="offer-label">Player 2 offers you:</p>
                        <p className="offer-amount-large">${gameState.currentRoundState.player2CoinsToOffer}</p>
                        <div className="decision-info">
                          <p className="keep-amount">
                            You always keep: ${gameState.currentRoundState.player1CoinsToKeep || 0}
                          </p>
                          <p className="keep-amount">
                            If you accept: You get ${(gameState.currentRoundState.player1CoinsToKeep || 0) + gameState.currentRoundState.player2CoinsToOffer} total
                          </p>
                          <p className="keep-amount">
                            If you reject: You get ${gameState.currentRoundState.player1CoinsToKeep || 0} total
                          </p>
                        </div>
                      </div>
                      
                      {!gameState.currentRoundState.player1ResponseMade && (
                        <div className="response-buttons">
                          <button
                            onClick={() => respondToPlayer("player_2", true)}
                            className="accept-button"
                          >
                            <CheckCircle className="button-icon" />
                            ACCEPT
                          </button>
                          <button
                            onClick={() => respondToPlayer("player_2", false)}
                            className="reject-button"
                          >
                            <XCircle className="button-icon" />
                            REJECT
                          </button>
                        </div>
                      )}
                      
                      {gameState.currentRoundState.player1ResponseMade && (
                        <p className="response-made">
                          You {gameState.currentRoundState.player1Response}ed this offer
                        </p>
                      )}
                    </div>
                  )}

                  {isPlayer2 && gameState.currentRoundState.player1CoinsToOffer !== null && (
                    <div className="offer-response-card">
                      <div className="offer-display">
                        <p className="offer-label">Player 1 offers you:</p>
                        <p className="offer-amount-large">${gameState.currentRoundState.player1CoinsToOffer}</p>
                        <div className="decision-info">
                          <p className="keep-amount">
                            You always keep: ${gameState.currentRoundState.player2CoinsToKeep || 0}
                          </p>
                          <p className="keep-amount">
                            If you accept: You get ${(gameState.currentRoundState.player2CoinsToKeep || 0) + gameState.currentRoundState.player1CoinsToOffer} total
                          </p>
                          <p className="keep-amount">
                            If you reject: You get ${gameState.currentRoundState.player2CoinsToKeep || 0} total
                          </p>
                        </div>
                      </div>
                      
                      {!gameState.currentRoundState.player2ResponseMade && (
                        <div className="response-buttons">
                          <button
                            onClick={() => respondToPlayer("player_1", true)}
                            className="accept-button"
                          >
                            <CheckCircle className="button-icon" />
                            ACCEPT
                          </button>
                          <button
                            onClick={() => respondToPlayer("player_1", false)}
                            className="reject-button"
                          >
                            <XCircle className="button-icon" />
                            REJECT
                          </button>
                        </div>
                      )}
                      
                      {gameState.currentRoundState.player2ResponseMade && (
                        <p className="response-made">
                          You {gameState.currentRoundState.player2Response}ed this offer
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Waiting phase */}
              {currentPhase === "waiting" && !gameState?.waitingForOpponent && (
                <div className="waiting-section">
                  <div className="waiting-animation">
                    <Loader2 className="waiting-spinner" />
                    <p className="waiting-text">
                      {!gameState?.currentRoundState?.player1OfferMade || !gameState?.currentRoundState?.player2OfferMade
                        ? "Waiting for all offers to be made…"
                        : "Waiting for all responses…"}
                    </p>
                  </div>
                  
                  {/* Show current round status */}
                  {gameState?.currentRoundState && (
                    <div className="round-status">
                      <p>
                        <span>Offers:</span>
                        <span>
                          {gameState.currentRoundState.player1OfferMade ? "✓" : "⏳"} Player 1, {" "}
                          {gameState.currentRoundState.player2OfferMade ? "✓" : "⏳"} Player 2
                        </span>
                      </p>
                      <p>
                        <span>Responses:</span>
                        <span>
                          {gameState.currentRoundState.player1ResponseMade ? "✓" : "⏳"} Player 1, {" "}
                          {gameState.currentRoundState.player2ResponseMade ? "✓" : "⏳"} Player 2
                        </span>
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Scores */}
        {gameState && !gameState.waitingForOpponent && (
          <div className="scores-section">
            <div className="score-item">
              <span>Your Score:</span>
              <span>
                ${isPlayer1 ? gameState.player1Score : gameState.player2Score}
              </span>
            </div>
            <div className="score-item">
              <span>Opponent Score:</span>
              <span>
                ${isPlayer1 ? gameState.player2Score : gameState.player1Score}
              </span>
            </div>
          </div>
        )}

        {/* Game history */}
        {gameState && gameState.roundHistory && gameState.roundHistory.length > 0 && (
          <div className="payoffs-area">
            <PayoffsTable history={gameState.roundHistory || []} />
          </div>
        )}

        {/* Debug info (only in development) */}
        {process.env.NODE_ENV === 'development' && gameState && (
          <div className="debug-info" style={{ marginTop: '2rem' }}>
            <h4>Debug Info:</h4>
            <p><strong>Current Phase:</strong> {currentPhase}</p>
            <p><strong>Is Player 1:</strong> {isPlayer1 ? "Yes" : "No"}</p>
            <p><strong>Is Player 2:</strong> {isPlayer2 ? "Yes" : "No"}</p>
            <p><strong>Connection Status:</strong> {connectionStatus}</p>
            {gameState.currentRoundState && (
              <>
                <p><strong>Round Number:</strong> {gameState.currentRoundState.roundNumber}</p>
                <p><strong>P1 Offer Made:</strong> {gameState.currentRoundState.player1OfferMade ? "Yes" : "No"}</p>
                <p><strong>P2 Offer Made:</strong> {gameState.currentRoundState.player2OfferMade ? "Yes" : "No"}</p>
                <p><strong>P1 Response Made:</strong> {gameState.currentRoundState.player1ResponseMade ? "Yes" : "No"}</p>
                <p><strong>P2 Response Made:</strong> {gameState.currentRoundState.player2ResponseMade ? "Yes" : "No"}</p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}