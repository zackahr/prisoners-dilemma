import { useState, useEffect, useRef, useCallback } from "react"

export const useWebSocket = (matchId, playerFingerprint) => {
  const [socket, setSocket] = useState(null)
  const [gameState, setGameState] = useState(null)
  const [connectionStatus, setConnectionStatus] = useState("disconnected")
  const [error, setError] = useState(null)
  const reconnectTimeoutRef = useRef(null)
  const reconnectAttemptsRef = useRef(0)
  const connectionRef = useRef(null) // Track connection status
  const maxReconnectAttempts = 5

  const connect = useCallback(() => {
    if (!matchId || !playerFingerprint) {
      console.log("❌ Cannot connect: missing matchId or playerFingerprint")
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

          if (data.error) {
            console.error("❌ Server error:", data.error)
            setError(data.error)
            
            // If match is full, don't try to reconnect
            if (data.error.includes("full") || data.error.includes("already started")) {
              reconnectAttemptsRef.current = maxReconnectAttempts
            }
            return
          }

          if (data.game_state) {
            console.log("🎮 Game state update:", data.game_state)
            setGameState(data.game_state)
          }

          if (data.game_over) {
            console.log("🏁 Game over:", data)
            setGameState((prev) => ({
              ...prev,
              gameOver: true,
              player1Score: data.player1_score,
              player2Score: data.player2_score,
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
        setError("Connection error occurred")
        setConnectionStatus("error")
        connectionRef.current = "error"
      }

      setSocket(ws)
      setConnectionStatus("connecting")
    } catch (err) {
      console.error("❌ Failed to create WebSocket connection:", err)
      setError("Failed to connect to game server")
      setConnectionStatus("error")
      connectionRef.current = "error"
    }
  }, [matchId, playerFingerprint])

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
    [socket],
  )

  // Connect when matchId and playerFingerprint are available
  useEffect(() => {
    if (matchId && playerFingerprint) {
      connect()
    }
    
    return () => {
      disconnect()
    }
  }, [matchId, playerFingerprint]) // Remove connect and disconnect from dependencies

  return {
    socket,
    gameState,
    connectionStatus,
    error,
    sendMessage,
    connect,
    disconnect,
  }
}