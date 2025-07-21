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
  Trophy,
  X,
} from "lucide-react"
import { useNavigate, useSearchParams } from "react-router-dom"

import PayoffsTable from "./PayoffsTable"
import { useWebSocket } from "../hooks/useWebSocket"
import { gameApi, getPlayerFingerprint } from "../services/gameApi"
import "./GamePage.css"

function RoundResultsModal({ data, isP1, isOpen, onClose }) {
  const [countdown, setCountdown] = useState(15);

  useEffect(() => {
    if (!isOpen) return;

    setCountdown(15);
    
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          onClose();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, onClose]);

  if (!isOpen || !data) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-container round-results-modal">
        <div className="modal-header">
          <div className="modal-icon">
            <Trophy className="trophy-icon" />
          </div>
          <h2 className="modal-title">Round {data.round_number} Results</h2>
          <button 
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="modal-content">
          <div className="round-summary-section">
            <h3>Round Summary</h3>
            
            <div className="proposal-summary">
              <div className="proposal-item">
                <h4>Your proposal:</h4>
                <p>
                  You kept ${isP1 ? (100 - data.p1_offer) : (100 - data.p2_offer)}, 
                  offered ${isP1 ? data.p1_offer : data.p2_offer} → 
                  <span className={`response-status ${isP1 ? data.p2_response : data.p1_response}`}>
                    {(isP1 ? data.p2_response : data.p1_response) === 'accept' ? 'Accepted' : 'Rejected'} by the other player
                  </span>
                </p>
              </div>
              
              <div className="proposal-item">
                <h4>Their proposal:</h4>
                <p>
                  They kept ${isP1 ? (100 - data.p2_offer) : (100 - data.p1_offer)}, 
                  offered ${isP1 ? data.p2_offer : data.p1_offer} → 
                  <span className={`response-status ${isP1 ? data.p1_response : data.p2_response}`}>
                    {(isP1 ? data.p1_response : data.p2_response) === 'accept' ? 'Accepted' : 'Rejected'} by you
                  </span>
                </p>
              </div>
            </div>
            
            <div className="payoff-summary">
              <h4>Your total payoff this round: <strong>${isP1 ? data.p1_earned : data.p2_earned} coins</strong></h4>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <div className="auto-close-info">
            <p>Next round starts automatically in <strong>{countdown}</strong> seconds</p>
          </div>
          <button 
            className="continue-btn"
            onClick={onClose}
          >
            Continue Now
          </button>
        </div>
      </div>
    </div>
  );
}

const MAX_ROUNDS = 25
const TOTAL_MONEY = 100
const OFFER_TIME_LIMIT = 25
const RESPONSE_TIME_LIMIT = 25

export default function GamePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const gameMode = searchParams.get("mode") || "online"
  const urlMatchId = searchParams.get("match") || null

  const [playerFingerprint] = useState(() => getPlayerFingerprint())
  const [matchId, setMatchId] = useState(urlMatchId)
  const [isInitializing, setIsInitializing] = useState(true)

  // Game state for simultaneous play
  const [inputOffer, setInputOffer] = useState("0")
  const [offerTimeLeft, setOfferTimeLeft] = useState(OFFER_TIME_LIMIT)
  const [responseTimeLeft, setResponseTimeLeft] = useState(RESPONSE_TIME_LIMIT)
  const [currentPhase, setCurrentPhase] = useState("waiting")
  
  // Round results modal state
  const [showRoundResults, setShowRoundResults] = useState(false)
  const [roundResultsData, setRoundResultsData] = useState(null)
  
  // Timer management
  const [roundStartTime, setRoundStartTime] = useState(null)
  const [timerInitialized, setTimerInitialized] = useState(false)
  
  // Timeout popup state
  const [showTimeoutPopup, setShowTimeoutPopup] = useState(false)
  const [timeoutCountdown, setTimeoutCountdown] = useState(5)

  const {
    gameState, latestResults, connectionStatus, error,
    matchTerminated, terminationReason,
    sendMessage, disconnect
  } = useWebSocket(matchId, playerFingerprint);

  // Handle round results
  useEffect(() => {
    if (!latestResults) return;

    console.log("📊 Received round results:", latestResults);
    setRoundResultsData(latestResults);
    setShowRoundResults(true);
    // Don't change phase here - let the modal handle the timing
  }, [latestResults]);

  // Handle round results modal close
  const handleRoundResultsClose = useCallback(() => {
    console.log("⏰ Closing round results modal");
    setShowRoundResults(false);
    setRoundResultsData(null);
    
    // Check if game is over before transitioning
    if (gameState?.gameOver) {
      console.log("🏁 Game is over, transitioning to game over screen");
      setCurrentPhase("gameOver");
    } else {
      console.log("▶️ Game continues, transitioning to waiting phase");
      setCurrentPhase("waiting");
    }
  }, [gameState?.gameOver]);

  useEffect(() => {
    const initializeMatch = async () => {
      if (urlMatchId) {
        console.log("🔗 Using existing match from URL:", urlMatchId)
        console.log("👤 Using fingerprint:", playerFingerprint)
        setMatchId(urlMatchId)
        setIsInitializing(false)
        return
      }

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
        
        const fallbackMatchId = `fallback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        console.log("🔄 Using fallback match ID:", fallbackMatchId)
        setMatchId(fallbackMatchId)
      } finally {
        setIsInitializing(false)
      }
    }

    initializeMatch()
  }, [gameMode, playerFingerprint, urlMatchId])

  useEffect(() => {
    if (matchTerminated) {
      const t = setTimeout(() => navigate("/ultimatum"), 2000);
      return () => clearTimeout(t);
    }
  }, [matchTerminated, navigate]);

  useEffect(() => {
    if (!gameState) return

    const currentRoundNumber = gameState.currentRound
    const currentRoundState = gameState.currentRoundState

    // Check if this is a new round that needs timer initialization
    const isNewRound = currentRoundState && (
      !currentRoundState.player1OfferMade && 
      !currentRoundState.player2OfferMade &&
      !currentRoundState.player1ResponseMade && 
      !currentRoundState.player2ResponseMade
    )

    if (isNewRound && (!roundStartTime || !timerInitialized)) {
      console.log("🕐 Initializing timers for new round:", currentRoundNumber)
      setRoundStartTime(Date.now())
      setOfferTimeLeft(OFFER_TIME_LIMIT)
      setResponseTimeLeft(RESPONSE_TIME_LIMIT)
      setTimerInitialized(true)
      setInputOffer("0") // Reset offer input for new round
    }

    // Reset timer initialization flag when round is complete
    if (gameState.gameOver || (currentRoundState && currentRoundState.player1ResponseMade && currentRoundState.player2ResponseMade)) {
      setTimerInitialized(false)
    }
  }, [gameState, roundStartTime, timerInitialized])

  // Determine current phase
  useEffect(() => {
    if (!gameState) return
    
    // Don't change phase if showing round results
    if (showRoundResults) return

    console.log("🎮 Processing game state update:", gameState)

    if (gameState.gameOver) {
      setCurrentPhase("gameOver")
      return
    }

    if (gameState.waitingForOpponent) {
      setCurrentPhase("waiting")
      return
    }

    const currentRound = gameState.currentRoundState
    if (!currentRound) {
      setCurrentPhase("offering")
      return
    }

    const isPlayer1 = gameState.player1Fingerprint === playerFingerprint
    const myOfferMade = isPlayer1 ? currentRound.player1OfferMade : currentRound.player2OfferMade
    const myResponseMade = isPlayer1 ? currentRound.player1ResponseMade : currentRound.player2ResponseMade
    const bothOffersMade = currentRound.player1OfferMade && currentRound.player2OfferMade

    // Determine phase and reset response timer when entering responding phase
    const newPhase = !myOfferMade ? "offering" : 
                     bothOffersMade && !myResponseMade ? "responding" : 
                     "waiting"

    // Reset response timer when entering responding phase
    if (currentPhase !== "responding" && newPhase === "responding") {
      console.log("🕐 Entering responding phase - resetting response timer")
      setResponseTimeLeft(RESPONSE_TIME_LIMIT)
    }

    setCurrentPhase(newPhase)
  }, [gameState, playerFingerprint, currentPhase, showRoundResults])

  // Handle timeout navigation with popup
  useEffect(() => {
    const isOfferTimeout = offerTimeLeft <= 0 && currentPhase === "offering"
    const isResponseTimeout = responseTimeLeft <= 0 && currentPhase === "responding"
    
    if (isOfferTimeout || isResponseTimeout) {
      console.log("⏰ Time's up! Showing timeout popup", { isOfferTimeout, isResponseTimeout })
      setShowTimeoutPopup(true)
      setTimeoutCountdown(5)
    }
  }, [offerTimeLeft, responseTimeLeft, currentPhase]);

  useEffect(() => {
    const handlePop = () => {
      disconnect();
      navigate("/ultimatum", { replace: true });
    };
    const handleUnload = () => disconnect();
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

  // Offer timer countdown
  useEffect(() => {
    if (showRoundResults || offerTimeLeft <= 0 || currentPhase !== "offering") return
    const timer = setTimeout(() => {
      setOfferTimeLeft((prev) => prev - 1)
    }, 1000)
    return () => clearTimeout(timer)
  }, [offerTimeLeft, currentPhase, showRoundResults])

  // Response timer countdown
  useEffect(() => {
    if (showRoundResults || responseTimeLeft <= 0 || currentPhase !== "responding") return
    const timer = setTimeout(() => {
      setResponseTimeLeft((prev) => prev - 1)
    }, 1000)
    return () => clearTimeout(timer)
  }, [responseTimeLeft, currentPhase, showRoundResults])

  // Submit offer
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

    // Don't reset inputOffer - keep the submitted offer visible
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

  // Helper to get current timer value based on phase
  const getCurrentTimeLeft = () => {
    if (currentPhase === "offering") return offerTimeLeft
    if (currentPhase === "responding") return responseTimeLeft
    return 0
  }

  // Timeout Popup Component
  const TimeoutPopup = () => {
    if (!showTimeoutPopup) return null

    return (
      <div className="modal-overlay">
        <div className="modal-container timeout-modal">
          <div className="modal-header">
            <div className="modal-icon">
              <AlertTriangle className="timeout-icon" />
            </div>
            <h2 className="modal-title">Time's Up!</h2>
          </div>
          <div className="modal-content">
            <p className="timeout-message">
              {currentPhase === "offering" 
                ? `The ${OFFER_TIME_LIMIT} seconds for making offers have passed.`
                : `The ${RESPONSE_TIME_LIMIT} seconds for responding have passed.`
              } You will be redirected to the menu.
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
              {/* <p><strong>Your fingerprint:</strong> {playerFingerprint}</p> */}
              {/* <p><strong>Match ID:</strong> {matchId}</p> */}
              {gameState && (
                <>
                  {/* <p><strong>Player 1:</strong> {gameState.player1Fingerprint}</p> */}
                  {/* <p><strong>Player 2:</strong> {gameState.player2Fingerprint}</p> */}
                  {/* <p><strong>Game Mode:</strong> {gameState.gameMode}</p> */}
                  {/* <p><strong>Current Round:</strong> {gameState.currentRound}</p> */}
                  {/* <p><strong>Waiting for Opponent:</strong> {gameState.waitingForOpponent ? "Yes" : "No"}</p> */}
                  {gameState.currentRoundState && (
                    <>
                      {/* <p><strong>P1 Offer Made:</strong> {gameState.currentRoundState.player1OfferMade ? "Yes" : "No"}</p> */}
                      {/* <p><strong>P2 Offer Made:</strong> {gameState.currentRoundState.player2OfferMade ? "Yes" : "No"}</p> */}
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
  if (currentPhase === "gameOver" && gameState?.gameOver) {  
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
        </div>
      </div>
    )
  }

  // Main game interface
  return (
    <div className="game-page">
      {/* Round Results Modal */}
      <RoundResultsModal 
        data={roundResultsData}
        isP1={isPlayer1}
        isOpen={showRoundResults}
        onClose={handleRoundResultsClose}
      />
      
      {/* Timeout Popup */}
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
                <span>{getCurrentTimeLeft()}s</span>
              </div>
              <h2 className="phase-title">
                {currentPhase === "offering" && "MAKE YOUR OFFER"}
                {currentPhase === "responding" && "RESPOND TO OFFERS"}
                {currentPhase === "waiting" && "WAITING…"}
                {currentPhase === "gameOver" && "GAME COMPLETE"}
              </h2>
            </div>

            <div className="game-card-content">
              {/* <div className="money-display">
                <div className="money-content">
                  <DollarSign className="money-icon" />
                  <span>{TOTAL_MONEY - (+inputOffer || 0)}</span>
                </div>
              </div> */}

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

              {/* Offering phase */}
              {currentPhase === "offering" && !gameState?.waitingForOpponent && (
                <div className="offer-section">
                  <div className="instructions-compact">
                    <p><strong>You and a player are dividing a stack of coins. If the other player rejects your proposal, you both get nothing. How much will you offer?</strong></p>
                  </div>
                  
                  <div className="visual-offer-container">
                    <div className="coin-stacks-container">
                      <div className="coin-stack you-stack">
                        <div className="coin-stack-visual" style={{ height: `${Math.max(30, Math.min(200, (TOTAL_MONEY - (+inputOffer || 0)) * 1.8))}px` }}>
                          <div className="coin-amount">${TOTAL_MONEY - (+inputOffer || 0)}</div>
                        </div>
                        <div className="stack-label">KEEP</div>
                      </div>
                      
                      <div className="slider-container">
                        <div className="percentage-scale">
                          <div className="scale-marker top">100%</div>
                          <div className="scale-marker middle">50%</div>
                          <div className="scale-marker bottom">0%</div>
                        </div>
                        <div className="vertical-slider">
                          <div className="slider-track"></div>
                          <div 
                            className="slider-handle"
                            style={{ 
                              top: `${100 - ((+inputOffer || 0) / TOTAL_MONEY * 100)}%`,
                              cursor: 'grab'
                            }}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              const slider = e.currentTarget.parentElement;
                              const rect = slider.getBoundingClientRect();
                              
                              const handleMove = (clientY) => {
                                const y = clientY - rect.top;
                                const percentage = Math.max(0, Math.min(100, (y / rect.height) * 100));
                                const offerAmount = Math.round((100 - percentage) / 100 * TOTAL_MONEY);
                                setInputOffer(offerAmount.toString());
                              };
                              
                              const handleMouseMove = (moveEvent) => {
                                handleMove(moveEvent.clientY);
                              };
                              
                              const handleMouseUp = () => {
                                document.removeEventListener('mousemove', handleMouseMove);
                                document.removeEventListener('mouseup', handleMouseUp);
                              };
                              
                              document.addEventListener('mousemove', handleMouseMove);
                              document.addEventListener('mouseup', handleMouseUp);
                            }}
                            onTouchStart={(e) => {
                              e.preventDefault();
                              const slider = e.currentTarget.parentElement;
                              const rect = slider.getBoundingClientRect();
                              
                              const handleMove = (clientY) => {
                                const y = clientY - rect.top;
                                const percentage = Math.max(0, Math.min(100, (y / rect.height) * 100));
                                const offerAmount = Math.round((100 - percentage) / 100 * TOTAL_MONEY);
                                setInputOffer(offerAmount.toString());
                              };
                              
                              const handleTouchMove = (moveEvent) => {
                                handleMove(moveEvent.touches[0].clientY);
                              };
                              
                              const handleTouchEnd = () => {
                                document.removeEventListener('touchmove', handleTouchMove);
                                document.removeEventListener('touchend', handleTouchEnd);
                              };
                              
                              document.addEventListener('touchmove', handleTouchMove);
                              document.addEventListener('touchend', handleTouchEnd);
                            }}
                          ></div>
                        </div>
                      </div>
                      
                      <div className="coin-stack other-stack">
                        <div className="coin-stack-visual" style={{ height: `${Math.max(30, Math.min(200, (+inputOffer || 0) * 1.8))}px` }}>
                          <div className="coin-amount">${+inputOffer || 0}</div>
                        </div>
                        <div className="stack-label">OFFER</div>
                      </div>
                    </div>
                  </div>
                  
                  <button
                    onClick={submitOffer}
                    disabled={+inputOffer < 0 || +inputOffer > TOTAL_MONEY}
                    className="submit-button-visual"
                  >
                    SUBMIT
                  </button>
                </div>
              )}

              {/* Responding phase */}
              {currentPhase === "responding" && gameState?.currentRoundState && (
                <div className="responding-section">
                  <div className="instructions-compact">
                    <p><strong>Decision time:</strong> Accept or reject the opponent's offer. Your earnings depend on both decisions.</p>
                  </div>
                  
                  {/* Response to opponent's offer */}
                  {isPlayer1 && gameState.currentRoundState.player2CoinsToOffer !== null && (
                    <div className="visual-response-container">
                      <div className="coin-stacks-container response-layout">
                        <div className="coin-stack other-stack">
                          <div className="coin-stack-visual" style={{ height: `${Math.max(80, Math.min(200, (TOTAL_MONEY - gameState.currentRoundState.player2CoinsToOffer) * 2.2))}px` }}>
                            <div className="coin-amount">${TOTAL_MONEY - gameState.currentRoundState.player2CoinsToOffer}</div>
                          </div>
                          <div className="stack-label">They want to keep</div>
                        </div>
                        
                        <div className="response-buttons-container">
                          {!gameState.currentRoundState.player1ResponseMade && (
                            <>
                              <button
                                onClick={() => respondToPlayer("player_2", true)}
                                className="accept-button-large"
                              >
                                ACCEPT
                              </button>
                              <button
                                onClick={() => respondToPlayer("player_2", false)}
                                className="reject-button-large"
                              >
                                REJECT
                              </button>
                            </>
                          )}
                          
                          {gameState.currentRoundState.player1ResponseMade && (
                            <div className="response-made-large">
                              You {gameState.currentRoundState.player1Response}ed this offer
                            </div>
                          )}
                        </div>
                        
                        <div className="coin-stack you-stack">
                          <div className="coin-stack-visual" style={{ height: `${Math.max(80, Math.min(200, gameState.currentRoundState.player2CoinsToOffer * 2.2))}px` }}>
                            <div className="coin-amount">${gameState.currentRoundState.player2CoinsToOffer}</div>
                          </div>
                          <div className="stack-label">YOU</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {isPlayer2 && gameState.currentRoundState.player1CoinsToOffer !== null && (
                    <div className="visual-response-container">
                      <div className="coin-stacks-container response-layout">
                        <div className="coin-stack other-stack">
                          <div className="coin-stack-visual" style={{ height: `${Math.max(80, Math.min(200, (TOTAL_MONEY - gameState.currentRoundState.player1CoinsToOffer) * 2.2))}px` }}>
                            <div className="coin-amount">${TOTAL_MONEY - gameState.currentRoundState.player1CoinsToOffer}</div>
                          </div>
                          <div className="stack-label">They want to keep</div>
                        </div>
                        
                        <div className="response-buttons-container">
                          {!gameState.currentRoundState.player2ResponseMade && (
                            <>
                              <button
                                onClick={() => respondToPlayer("player_1", true)}
                                className="accept-button-large"
                              >
                                ACCEPT
                              </button>
                              <button
                                onClick={() => respondToPlayer("player_1", false)}
                                className="reject-button-large"
                              >
                                REJECT
                              </button>
                            </>
                          )}
                          
                          {gameState.currentRoundState.player2ResponseMade && (
                            <div className="response-made-large">
                              You {gameState.currentRoundState.player2Response}ed this offer
                            </div>
                          )}
                        </div>
                        
                        <div className="coin-stack you-stack">
                          <div className="coin-stack-visual" style={{ height: `${Math.max(80, Math.min(200, gameState.currentRoundState.player1CoinsToOffer * 2.2))}px` }}>
                            <div className="coin-amount">${gameState.currentRoundState.player1CoinsToOffer}</div>
                          </div>
                          <div className="stack-label">You</div>
                        </div>
                      </div>
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
        {/* {gameState && !gameState.waitingForOpponent && (
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
        )} */}

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
            <p><strong>Offer Time Left:</strong> {offerTimeLeft}s</p>
            <p><strong>Response Time Left:</strong> {responseTimeLeft}s</p>
            <p><strong>Show Round Results:</strong> {showRoundResults ? 'Yes' : 'No'}</p>
            <p><strong>Round Start Time:</strong> {roundStartTime ? new Date(roundStartTime).toLocaleTimeString() : 'Not set'}</p>
            <p><strong>Timer Initialized:</strong> {timerInitialized ? 'Yes' : 'No'}</p>
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