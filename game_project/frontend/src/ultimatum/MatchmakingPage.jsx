import { useState, useEffect, useRef } from "react"
import { Loader2, Wifi, WifiOff, Users } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { gameApi, generatePlayerFingerprint } from "../services/gameApi"
import "./MatchmakingPage.css"

export default function MatchmakingPage() {
  const navigate = useNavigate()
  const [playerFingerprint] = useState(() => generatePlayerFingerprint())
  const [matchId, setMatchId] = useState(null)
  const [status, setStatus] = useState("searching") // searching, waiting, found, error
  const [error, setError] = useState(null)
  const pollTimeoutRef = useRef(null)
  const mountedRef = useRef(true)
  const pollAttempts = useRef(0)
  const maxPollAttempts = 15 // 30 seconds max

  useEffect(() => {
    return () => {
      mountedRef.current = false
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    const findMatch = async () => {
      if (!mountedRef.current) return
      
      try {
        console.log("🔍 Searching for online match...")
        setStatus("searching")

        const matchData = await gameApi.createMatch("online", playerFingerprint)

        if (!mountedRef.current) return

        console.log("✅ Match result:", matchData)
        setMatchId(matchData.match_id)

        if (matchData.status === "joined_existing_match") {
          console.log("🎯 Joined existing match, starting game immediately")
          setStatus("found")
          setTimeout(() => {
            if (mountedRef.current) {
              navigate(`/ultimatum/game?mode=online&match=${matchData.match_id}`)
            }
          }, 1500)
        } else if (matchData.status === "created_new_match") {
          console.log("⏳ Created new match, waiting for opponent")
          setStatus("waiting")
          pollAttempts.current = 0
          checkMatchStatus(matchData.match_id)
        }
      } catch (error) {
        console.error("❌ Error finding match:", error)
        if (mountedRef.current) {
          setError(error.message)
          setStatus("error")
        }
      }
    }

    findMatch()
  }, [navigate, playerFingerprint])

  const checkMatchStatus = async (matchId) => {
    if (!mountedRef.current) return
    
    try {
      pollAttempts.current++
      console.log(`🔄 Checking match status (attempt ${pollAttempts.current}/${maxPollAttempts})`)
      
      const stats = await gameApi.getMatchStats(matchId)
      
      if (!mountedRef.current) return
      
      console.log("📊 Match stats:", stats)
      
      // Check if second player joined
      if (stats.players_count >= 2 || stats.is_ready) {
        console.log("🎯 Opponent found! Starting game...")
        setStatus("found")
        setTimeout(() => {
          if (mountedRef.current) {
            navigate(`/ultimatum/game?mode=online&match=${matchId}`)
          }
        }, 1000)
        return
      }
      
      // Check if we've exceeded max attempts
      if (pollAttempts.current >= maxPollAttempts) {
        console.log("⏰ Timeout reached, proceeding to game anyway...")
        setStatus("found")
        setTimeout(() => {
          if (mountedRef.current) {
            navigate(`/ultimatum/game?mode=online&match=${matchId}`)
          }
        }, 1000)
        return
      }
      
      // Continue polling with exponential backoff
      const delay = Math.min(1000 + (pollAttempts.current * 200), 3000)
      pollTimeoutRef.current = setTimeout(() => {
        checkMatchStatus(matchId)
      }, delay)
      
    } catch (error) {
      console.error("❌ Error checking match status:", error)
      
      // If we get an error, try a few more times then proceed
      if (pollAttempts.current >= 3) {
        console.log("⚠️ Multiple errors, proceeding to game...")
        setStatus("found")
        setTimeout(() => {
          if (mountedRef.current) {
            navigate(`/ultimatum/game?mode=online&match=${matchId}`)
          }
        }, 1000)
        return
      }
      
      // Retry with backoff
      const delay = Math.min(1000 + (pollAttempts.current * 500), 3000)
      pollTimeoutRef.current = setTimeout(() => {
        checkMatchStatus(matchId)
      }, delay)
    }
  }

  const handleCancel = () => {
    console.log("❌ User cancelled matchmaking")
    mountedRef.current = false
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current)
    }
    navigate("/ultimatum")
  }

  const handleRetry = () => {
    console.log("🔄 Retrying matchmaking")
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current)
    }
    setError(null)
    setStatus("searching")
    setMatchId(null)
    pollAttempts.current = 0
    // Trigger re-render to restart the effect
    window.location.reload()
  }

  return (
    <div className="matchmaking-page">
      <div className="matchmaking-container">
        <div className="matchmaking-header">
          <h1 className="matchmaking-title">Ultimatum Game</h1>
          <p className="matchmaking-subtitle">Finding an opponent for your online match...</p>
        </div>

        <div className="matchmaking-card">
          <div className="matchmaking-icon-container">
            {status === "searching" || status === "waiting" ? (
              <Loader2 className="matchmaking-spinner" />
            ) : status === "found" ? (
              <div className="matchmaking-success">
                <Users className="success-icon" />
              </div>
            ) : (
              <div className="matchmaking-error">
                <WifiOff className="error-icon" />
              </div>
            )}
          </div>

          <h2 className="matchmaking-status-title">
            {status === "searching" && "Searching for Match..."}
            {status === "waiting" && "Waiting for Opponent..."}
            {status === "found" && "Opponent Found!"}
            {status === "error" && "Connection Error"}
          </h2>

          <p className="matchmaking-status-text">
            {status === "searching" && "Looking for available matches or creating a new one..."}
            {status === "waiting" && `Match created! Waiting for another player to join... (${pollAttempts.current}/${maxPollAttempts})`}
            {status === "found" && "Match found! Starting game..."}
            {status === "error" && (error || "Something went wrong. Please try again.")}
          </p>

          <div className="matchmaking-info">
            <div className="matchmaking-info-row">
              <span>Your ID:</span>
              <span className="matchmaking-player-id">{playerFingerprint}</span>
            </div>
            {matchId && (
              <div className="matchmaking-info-row">
                <span>Match ID:</span>
                <span className="matchmaking-match-id">{matchId}</span>
              </div>
            )}
            <div className="matchmaking-info-row">
              <span>Status:</span>
              <div className="connection-status">
                {status === "searching" || status === "waiting" ? (
                  <>
                    <Loader2 className="connection-icon connection-connecting" />
                    <span className="connection-connecting">{status === "searching" ? "Searching" : "Waiting"}</span>
                  </>
                ) : status === "found" ? (
                  <>
                    <Wifi className="connection-icon connection-connected" />
                    <span className="connection-connected">Ready</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="connection-icon connection-disconnected" />
                    <span className="connection-disconnected">Error</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="matchmaking-buttons">
            {(status === "searching" || status === "waiting") && (
              <button onClick={handleCancel} className="cancel-button">
                Cancel Search
              </button>
            )}
            {status === "error" && (
              <>
                <button onClick={handleRetry} className="retry-button">
                  Try Again
                </button>
                <button onClick={handleCancel} className="cancel-button">
                  Back to Menu
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}