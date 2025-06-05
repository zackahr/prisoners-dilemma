import { useState, useEffect, useRef, useCallback } from "react"

export const useWebSocket = (matchId, playerFingerprint) => {
  const [socket, setSocket] = useState(null)
  const [gameState, setGameState] = useState(null)
  const [connectionStatus, setConnectionStatus] = useState("disconnected")
  const [error, setError] = useState(null)
  const [matchTerminated, setMatchTerminated] = useState(false)
  const reconnectTimeoutRef = useRef(null)
  const reconnectAttemptsRef = useRef(0)
  const connectionRef = useRef(null)
  const maxReconnectAttempts = 5

  const connect = useCallback(() => {
    if (!matchId || !playerFingerprint) {
      console.log("❌ Cannot connect: missing matchId or playerFingerprint")
      return
    }

    // Don't reconnect if match was terminated
    if (matchTerminated) {
      console.log("❌ Match was terminated - not reconnecting")
      return
    }

    // Prevent multiple connection attempts
    if (connectionRef.current === "connecting" || connectionRef.current === "connected") {
      console.log("⚠️ Connection already in progress or established")
      return
    }

    // Clear any existing reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    try {
      const wsUrl = `ws://localhost:8001/ws/ultimatum-game/${matchId}/`
      console.log("🔌 Connecting to WebSocket:", wsUrl)
      console.log("👤 Player fingerprint:", playerFingerprint)

      connectionRef.current = "connecting"
      setConnectionStatus("connecting")
      
      const ws = new WebSocket(wsUrl)

      ws.onopen = () => {
        console.log("✅ WebSocket connected successfully")
        setConnectionStatus("connected")
        connectionRef.current = "connected"
        setError(null)
        reconnectAttemptsRef.current = 0

        // Join the game immediately after connection
        const joinMessage = {
          action: "join",
          player_fingerprint: playerFingerprint,
        }
        console.log("📤 Sending join message:", joinMessage)
        ws.send(JSON.stringify(joinMessage))
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          console.log("📥 Received WebSocket message:", data)

          // Handle match termination
          if (data.match_terminated) {
            console.log("🚫 Match terminated:", data.reason)
            setMatchTerminated(true)
            setError(`Match ended: ${data.reason}`)
            reconnectAttemptsRef.current = maxReconnectAttempts // Prevent reconnection
            return
          }

          if (data.error) {
            console.error("❌ Server error:", data.error)
            setError(data.error)
            
            // If critical errors, don't try to reconnect
            const criticalErrors = ["full", "already started", "Cannot join match"]
            if (criticalErrors.some(err => data.error.includes(err))) {
              reconnectAttemptsRef.current = maxReconnectAttempts
            }
            return
          }

          if (data.game_state) {
            console.log("🎮 Game state update:", data.game_state)
            setGameState(data.game_state)
            
            // Clear any connection errors once we get valid game state
            if (data.game_state && !data.game_state.error) {
              setError(null)
            }
          }

          if (data.game_over) {
            console.log("🏁 Game over:", data)
            setGameState((prev) => ({
              ...prev,
              gameOver: true,
              player1Score: data.player1_score || 0,
              player2Score: data.player2_score || 0,
            }))
          }

          if (data.game_aborted) {
            console.log("⚠️ Game aborted:", data.message)
            setError(data.message)
          }

          if (data.action) {
            console.log("🎯 Player action:", data)
            setGameState((prev) => {
              if (!prev) return prev

              const updated = { ...prev }

              if (data.action === "make_offer") {
                updated.currentRoundState = {
                  ...updated.currentRoundState,
                  offerMade: true,
                  offer: data.offer,
                }
                console.log("💰 Offer made:", data.offer, "by player:", data.player_fingerprint)
              }

              if (data.action === "respond_to_offer") {
                updated.currentRoundState = {
                  ...updated.currentRoundState,
                  responseMade: true,
                  response: data.response,
                }
                console.log("🤔 Response made:", data.response, "by player:", data.player_fingerprint)
              }

              return updated
            })
          }
        } catch (err) {
          console.error("❌ Error parsing WebSocket message:", err, event.data)
        }
      }

      ws.onclose = (event) => {
        console.log("🔌 WebSocket closed:", event.code, event.reason)
        setConnectionStatus("disconnected")
        connectionRef.current = "disconnected"
        setSocket(null)

        // Handle specific close codes
        if (event.code === 4004) {
          setError("Match not found")
          console.log("🚫 Match not found - not attempting to reconnect")
          return
        }

        if (event.code === 4001) {
          setError("Match terminated by server")
          setMatchTerminated(true)
          console.log("🚫 Match terminated by server - not attempting to reconnect")
          return
        }

        // Don't reconnect if match was terminated
        if (matchTerminated) {
          console.log("🚫 Match terminated - not attempting to reconnect")
          return
        }

        // Don't reconnect if it was a normal closure or if we've exceeded max attempts
        if (event.code === 1000 || reconnectAttemptsRef.current >= maxReconnectAttempts) {
          console.log("🚫 Not attempting to reconnect")
          return
        }

        // Attempt to reconnect with exponential backoff
        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 10000)
        console.log(
          `🔄 Attempting to reconnect in ${delay}ms (attempt ${reconnectAttemptsRef.current + 1}/${maxReconnectAttempts})`
        )

        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectAttemptsRef.current++
          connectionRef.current = "disconnected"
          connect()
        }, delay)
      }

      ws.onerror = (error) => {
        console.error("❌ WebSocket error:", error)
        setConnectionStatus("error")
        connectionRef.current = "error"
        
        // Don't set generic error message immediately - wait for onclose
        if (error.code === "ECONNREFUSED") {
          setError("Cannot connect to game server")
        }
      }

      setSocket(ws)
    } catch (err) {
      console.error("❌ Failed to create WebSocket connection:", err)
      setError("Failed to connect to game server")
      setConnectionStatus("error")
      connectionRef.current = "error"
    }
  }, [matchId, playerFingerprint, matchTerminated])

  const disconnect = useCallback(() => {
    console.log("🔌 Disconnecting WebSocket")
    
    // Clear reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    
    // Reset connection state
    connectionRef.current = "disconnected"
    reconnectAttemptsRef.current = maxReconnectAttempts // Prevent reconnect
    
    if (socket && socket.readyState !== WebSocket.CLOSED) {
      socket.close(1000, "Manual disconnect")
    }
    
    setSocket(null)
    setConnectionStatus("disconnected")
  }, [socket])

  const sendMessage = useCallback(
    (message) => {
      if (matchTerminated) {
        console.log("❌ Cannot send message: match terminated")
        return false
      }

      if (socket && socket.readyState === WebSocket.OPEN) {
        console.log("📤 Sending message:", message)
        socket.send(JSON.stringify(message))
        return true
      } else {
        console.error("❌ Cannot send message: WebSocket not connected")
        setError("Not connected to game server")
        return false
      }
    },
    [socket, matchTerminated],
  )

  // Connect when matchId and playerFingerprint are available
  useEffect(() => {
    if (matchId && playerFingerprint && !matchTerminated) {
      connect()
    }
    
    return () => {
      disconnect()
    }
  }, [matchId, playerFingerprint, matchTerminated]) // Add matchTerminated dependency

  return {
    socket,
    gameState,
    connectionStatus,
    error,
    matchTerminated,
    sendMessage,
    connect,
    disconnect,
  }
}