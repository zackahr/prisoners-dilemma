"use client"

import { useState, useEffect, useCallback } from "react"
import { Clock, DollarSign, CheckCircle, XCircle, TrendingUp, TrendingDown } from "lucide-react"
import { useNavigate, useSearchParams } from "react-router-dom"
import "./GamePage.css"

export default function GamePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const gameMode = searchParams.get("mode") || "online"

  const [gameState, setGameState] = useState({
    phase: "proposing", // "proposing", "waiting", "responding", "result"
    totalAmount: 100,
    myOffer: 0,
    opponentOffer: 0,
    timeLeft: 30,
    myResponse: null, // "accepted" | "rejected" | null
    opponentResponse: null, // "accepted" | "rejected" | null
    gameResult: null,
    roundNumber: 1,
  })

  const [inputOffer, setInputOffer] = useState("")

  // Timer effect
  useEffect(() => {
    if (gameState.timeLeft > 0 && (gameState.phase === "proposing" || gameState.phase === "responding")) {
      const timer = setTimeout(() => {
        setGameState((prev) => ({ ...prev, timeLeft: prev.timeLeft - 1 }))
      }, 1000)
      return () => clearTimeout(timer)
    } else if (gameState.timeLeft === 0) {
      if (gameState.phase === "proposing") {
        handleSubmitOffer()
      } else if (gameState.phase === "responding") {
        handleResponse(false) // Auto-reject if time runs out
      }
    }
  }, [gameState.timeLeft, gameState.phase])

  const handleSubmitOffer = useCallback(() => {
    const offer = Number.parseInt(inputOffer) || 0
    if (offer < 0 || offer > gameState.totalAmount) return

    setGameState((prev) => ({
      ...prev,
      myOffer: offer,
      phase: "waiting",
      timeLeft: 15,
    }))

    // Simulate opponent making their offer
    setTimeout(() => {
      let opponentOffer
      if (gameMode === "bot") {
        // Bot makes a strategic offer based on fairness
        opponentOffer = Math.floor(Math.random() * 20) + 25 // 25-45 range
      } else {
        // For demo purposes, simulate another player's offer
        opponentOffer = Math.floor(Math.random() * 30) + 20 // 20-50 range
      }

      setGameState((prev) => ({
        ...prev,
        opponentOffer,
        phase: "responding",
        timeLeft: 30,
      }))
    }, 3000)
  }, [inputOffer, gameState.totalAmount, gameMode])

  const handleResponse = (accepted) => {
    setGameState((prev) => ({
      ...prev,
      myResponse: accepted ? "accepted" : "rejected",
      timeLeft: 15,
    }))

    // Simulate opponent's response
    setTimeout(() => {
      let opponentAccepted
      if (gameMode === "bot") {
        // Bot accepts if offer is fair (30% or more)
        opponentAccepted = gameState.myOffer >= gameState.totalAmount * 0.3
      } else {
        // For demo purposes, random response weighted by fairness
        const fairnessThreshold = gameState.myOffer / gameState.totalAmount
        opponentAccepted = Math.random() < fairnessThreshold + 0.2
      }

      const myAccepted = accepted
      const bothAccepted = myAccepted && opponentAccepted

      let result
      if (bothAccepted) {
        result = "both_accepted"
      } else if (myAccepted && !opponentAccepted) {
        result = "opponent_rejected"
      } else if (!myAccepted && opponentAccepted) {
        result = "i_rejected"
      } else {
        result = "both_rejected"
      }

      setGameState((prev) => ({
        ...prev,
        opponentResponse: opponentAccepted ? "accepted" : "rejected",
        phase: "result",
        gameResult: result,
      }))
    }, 2000)
  }

  const handlePlayAgain = () => {
    if (gameMode === "bot") {
      setGameState({
        phase: "proposing",
        totalAmount: 100,
        myOffer: 0,
        opponentOffer: 0,
        timeLeft: 30,
        myResponse: null,
        opponentResponse: null,
        gameResult: null,
        roundNumber: gameState.roundNumber + 1,
      })
      setInputOffer("")
    } else {
      navigate("/ultimatum/matchmaking")
    }
  }

  const handleBackToMenu = () => {
    navigate("/ultimatum")
  }

  const getMyEarnings = () => {
    if (gameState.gameResult === "both_accepted") {
      return gameState.totalAmount - gameState.myOffer + gameState.opponentOffer
    }
    return 0
  }

  const getOpponentEarnings = () => {
    if (gameState.gameResult === "both_accepted") {
      return gameState.totalAmount - gameState.opponentOffer + gameState.myOffer
    }
    return 0
  }

  if (gameState.phase === "result") {
    const myEarnings = getMyEarnings()
    const opponentEarnings = getOpponentEarnings()
    const bothAccepted = gameState.gameResult === "both_accepted"

    return (
      <div className="game-over-page">
        <div className="game-over-container">
          <div className="game-over-header">
            <h1 className="game-over-title">Round {gameState.roundNumber} Complete</h1>
          </div>

          <div className="result-card">
            <div className="result-header">
              <div
                className={`result-icon-container ${bothAccepted ? "result-icon-accepted" : "result-icon-rejected"}`}
              >
                {bothAccepted ? (
                  <CheckCircle className="result-icon result-icon-green" />
                ) : (
                  <XCircle className="result-icon result-icon-red" />
                )}
              </div>
              <h2 className={`result-title ${bothAccepted ? "result-title-accepted" : "result-title-rejected"}`}>
                {gameState.gameResult === "both_accepted" && "Both Offers Accepted!"}
                {gameState.gameResult === "opponent_rejected" && "Opponent Rejected Your Offer"}
                {gameState.gameResult === "i_rejected" && "You Rejected Opponent's Offer"}
                {gameState.gameResult === "both_rejected" && "Both Offers Rejected"}
              </h2>
            </div>
            <div className="result-content">
              <div className="game-summary">
                <h3 className="summary-title">Round Summary</h3>
                <div className="summary-grid">
                  <div className="summary-item">
                    <div className="summary-amount">${gameState.myOffer}</div>
                    <div className="summary-label">Your Offer</div>
                    <div className="summary-status">
                      {gameState.opponentResponse === "accepted" ? "✓ Accepted" : "✗ Rejected"}
                    </div>
                  </div>
                  <div className="summary-item">
                    <div className="summary-amount">${gameState.opponentOffer}</div>
                    <div className="summary-label">Opponent's Offer</div>
                    <div className="summary-status">
                      {gameState.myResponse === "accepted" ? "✓ Accepted" : "✗ Rejected"}
                    </div>
                  </div>
                </div>
              </div>

              <div className="earnings-grid">
                <div
                  className={`earnings-card ${bothAccepted ? "earnings-card-accepted-player" : "earnings-card-rejected"}`}
                >
                  <div className="earnings-icons">
                    <DollarSign
                      className={`earnings-icon ${bothAccepted ? "earnings-icon-green" : "earnings-icon-red"}`}
                    />
                    {bothAccepted ? (
                      <TrendingUp className="earnings-icon earnings-icon-green" />
                    ) : (
                      <TrendingDown className="earnings-icon earnings-icon-red" />
                    )}
                  </div>
                  <div className={`earnings-amount ${bothAccepted ? "earnings-amount-green" : "earnings-amount-red"}`}>
                    ${myEarnings}
                  </div>
                  <div className="earnings-label">Your Earnings</div>
                </div>

                <div
                  className={`earnings-card ${bothAccepted ? "earnings-card-accepted-opponent" : "earnings-card-rejected"}`}
                >
                  <div className="earnings-icons">
                    <DollarSign
                      className={`earnings-icon ${bothAccepted ? "earnings-icon-blue" : "earnings-icon-red"}`}
                    />
                    {bothAccepted ? (
                      <TrendingUp className="earnings-icon earnings-icon-blue" />
                    ) : (
                      <TrendingDown className="earnings-icon earnings-icon-red" />
                    )}
                  </div>
                  <div className={`earnings-amount ${bothAccepted ? "earnings-amount-blue" : "earnings-amount-red"}`}>
                    ${opponentEarnings}
                  </div>
                  <div className="earnings-label">{gameMode === "online" ? "Opponent" : "Bot"} Earnings</div>
                </div>
              </div>

              <div className="result-message">
                <p className="result-message-text">
                  {gameState.gameResult === "both_accepted" && (
                    <>
                      Excellent! Both offers were accepted. You offered <strong>${gameState.myOffer}</strong> and
                      received <strong>${gameState.opponentOffer}</strong>.
                    </>
                  )}
                  {gameState.gameResult === "opponent_rejected" && (
                    <>
                      Your opponent rejected your offer of <strong>${gameState.myOffer}</strong>, but you accepted their
                      offer of <strong>${gameState.opponentOffer}</strong>. No one earned money this round.
                    </>
                  )}
                  {gameState.gameResult === "i_rejected" && (
                    <>
                      You rejected your opponent's offer of <strong>${gameState.opponentOffer}</strong>, but they
                      accepted your offer of <strong>${gameState.myOffer}</strong>. No one earned money this round.
                    </>
                  )}
                  {gameState.gameResult === "both_rejected" && (
                    <>
                      Both offers were rejected. You offered <strong>${gameState.myOffer}</strong> and they offered{" "}
                      <strong>${gameState.opponentOffer}</strong>. No one earned money this round.
                    </>
                  )}
                </p>
              </div>

              <div className="action-buttons">
                <button onClick={handlePlayAgain} className="play-again-button">
                  Play Again
                </button>
                <button onClick={handleBackToMenu} className="menu-button">
                  Main Menu
                </button>
              </div>
            </div>
          </div>

          <div className="strategy-tip">
            <p className="strategy-tip-text">
              <strong>Strategy Tip:</strong> In mutual ultimatum games, consider both fairness and reciprocity. Generous
              offers are more likely to be accepted, but you also want to maximize your own earnings!
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="game-page">
      <div className="game-container">
        <div className="game-header">
          <h1 className="game-title">Ultimatum</h1>
          <p className="game-subtitle">
            Both players make offers to each other. You'll then decide whether to accept or reject your opponent's
            offer. If both accept, you both earn money. If either rejects, nobody gets anything.
          </p>
        </div>

        <div className="game-board">
          <div className="game-card">
            <div className="game-card-header">
              <div className="timer">
                <Clock className="timer-icon" />
                <span>{gameState.timeLeft}s</span>
              </div>
              <h2 className="phase-title">
                {gameState.phase === "proposing"
                  ? "MAKE OFFER"
                  : gameState.phase === "waiting"
                    ? "WAITING..."
                    : gameState.phase === "responding"
                      ? "RESPOND"
                      : "RESULT"}
              </h2>
            </div>

            <div className="game-card-content">
              <div className="money-display">
                <div className="money-content">
                  <DollarSign className="money-icon" />
                  <span>{gameState.totalAmount}</span>
                </div>
              </div>

              {gameState.phase === "proposing" && (
                <div className="offer-section">
                  <p className="offer-label">How much will you offer your opponent?</p>
                  <div className="offer-input-container">
                    <input
                      type="number"
                      value={inputOffer}
                      onChange={(e) => setInputOffer(e.target.value)}
                      placeholder="0"
                      min="0"
                      max={gameState.totalAmount}
                      className="offer-input"
                    />
                    <div className="dollar-sign">$</div>
                  </div>
                  <button
                    onClick={handleSubmitOffer}
                    disabled={
                      !inputOffer ||
                      Number.parseInt(inputOffer) < 0 ||
                      Number.parseInt(inputOffer) > gameState.totalAmount
                    }
                    className="submit-button"
                  >
                    SUBMIT OFFER
                  </button>
                </div>
              )}

              {gameState.phase === "waiting" && (
                <div className="waiting-section">
                  <div className="waiting-animation">
                    <div className="waiting-spinner"></div>
                    <p className="waiting-text">Waiting for opponent to make their offer...</p>
                  </div>
                  <p className="offer-amount">Your offer: ${gameState.myOffer}</p>
                </div>
              )}

              {gameState.phase === "responding" && (
                <div className="responding-section">
                  <div className="offers-comparison">
                    <div className="offer-item">
                      <p className="offer-label-small">Your Offer</p>
                      <p className="offer-amount-large">${gameState.myOffer}</p>
                    </div>
                    <div className="offer-item">
                      <p className="offer-label-small">Opponent's Offer</p>
                      <p className="offer-amount-large highlight">${gameState.opponentOffer}</p>
                    </div>
                  </div>

                  <div className="decision-info">
                    <p className="decision-text">
                      Your opponent offers you <span className="highlight-amount">${gameState.opponentOffer}</span>
                    </p>
                    <p className="keep-amount">If you accept, you'll earn: ${gameState.opponentOffer}</p>
                    <p className="keep-amount">If you reject, you'll earn: $0</p>
                  </div>

                  <div className="response-buttons">
                    <button onClick={() => handleResponse(true)} className="accept-button">
                      ACCEPT OFFER
                    </button>
                    <button onClick={() => handleResponse(false)} className="reject-button">
                      REJECT OFFER
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
