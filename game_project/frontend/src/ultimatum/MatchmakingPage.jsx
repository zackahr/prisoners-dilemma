"use client"

import { useState, useEffect } from "react"
import { Loader2, Wifi, WifiOff } from "lucide-react"
import { useNavigate } from "react-router-dom"
import "./MatchmakingPage.css"

export default function MatchmakingPage() {
  const navigate = useNavigate()
  const [isSearching, setIsSearching] = useState(true)
  const [playerId, setPlayerId] = useState("")
  const [connectionStatus, setConnectionStatus] = useState("connecting")

  useEffect(() => {
    // Generate a random player ID
    const id = `player_${Math.random().toString(36).substr(2, 9)}`
    setPlayerId(id)

    // Simulate connection process
    const connectTimer = setTimeout(() => {
      setConnectionStatus("connected")
    }, 2000)

    // Simulate finding opponent (for demo purposes)
    const matchTimer = setTimeout(() => {
      setIsSearching(false)
      // Navigate to game after finding opponent
      setTimeout(() => {
        navigate("/ultimatum/game?mode=online")
      }, 1500)
    }, 8000)

    return () => {
      clearTimeout(connectTimer)
      clearTimeout(matchTimer)
    }
  }, [navigate])

  const handleCancel = () => {
    navigate("/ultimatum")
  }

  return (
    <div className="matchmaking-page">
      <div className="matchmaking-container">
        <div className="matchmaking-header">
          <h1 className="matchmaking-title">Ultimatum</h1>
          <p className="matchmaking-subtitle">
            You and a player are dividing a stack of coins. If the other player rejects your proposal, you both get
            nothing. How much will you offer?
          </p>
        </div>

        <div className="matchmaking-card">
          <div className="matchmaking-icon-container">
            {isSearching ? (
              <Loader2 className="matchmaking-spinner" />
            ) : (
              <div className="matchmaking-success">
                <span>✓</span>
              </div>
            )}
          </div>
          <h2 className="matchmaking-status-title">{isSearching ? "Waiting for Opponent" : "Opponent Found!"}</h2>
          <p className="matchmaking-status-text">
            {isSearching
              ? "Please wait while we find another player to join your game..."
              : "Match found! Starting game..."}
          </p>

          <div className="matchmaking-info">
            <div className="matchmaking-info-row">
              <span>Your ID:</span>
              <span className="matchmaking-player-id">{playerId}</span>
            </div>
            <div className="matchmaking-info-row">
              <span>Connection Status:</span>
              <div className="connection-status">
                {connectionStatus === "connected" ? (
                  <>
                    <Wifi className="connection-icon connection-connected" />
                    <span className="connection-connected">Connected</span>
                  </>
                ) : connectionStatus === "connecting" ? (
                  <>
                    <Loader2 className="connection-icon connection-connecting" />
                    <span className="connection-connecting">Connecting</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="connection-icon connection-disconnected" />
                    <span className="connection-disconnected">Disconnected</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {isSearching && (
            <button onClick={handleCancel} className="cancel-button">
              Cancel Search
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
