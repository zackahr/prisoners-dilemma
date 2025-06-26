import { useState, useEffect, useRef, useCallback } from "react"
const PORT        = 8001;                                // same number as above
const WS_BASE_URL = `ws://localhost:${PORT}`;
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
  const OFFER_TIME_LIMIT = 15;
  const [terminationReason, setTerminationReason]   = useState(null);  // NEW
  // top of hook
  const [latestResults, setLatestResults] = useState(null);

  const connect = useCallback(() => {
    if (!matchId || !playerFingerprint) {
      console.log("❌ Cannot connect: missing matchId or playerFingerprint")
      return
    }

    if (matchTerminated) {
      console.log("❌ Match was terminated - not reconnecting")
      return
    }

    if (connectionRef.current === "connecting" || connectionRef.current === "connected") {
      console.log("⚠️ Connection already in progress or established")
      return
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    try {
      // const wsUrl = `ws://localhost:8001/ws/ultimatum-game/${matchId}/`
      const wsUrl = `${WS_BASE_URL}/ws/ultimatum-game/${matchId}/`;
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

          if (data.match_terminated) {
            console.log("🚫 Match terminated:", data.reason)
            setMatchTerminated(true)
            setError(`Match ended: ${data.reason}`)
            reconnectAttemptsRef.current = maxReconnectAttempts
            setTerminationReason(data.reason);
            return
          }

          if (data.error) {
            console.error("❌ Server error:", data.error)
            setError(data.error)
            
            const criticalErrors = ["full", "already started", "Cannot join match"]
            if (criticalErrors.some(err => data.error.includes(err))) {
              reconnectAttemptsRef.current = maxReconnectAttempts
            }
            return
          }

          if (data.game_state) {
            console.log("🎮 Game state update:", data.game_state)
            setGameState(data.game_state)
            
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
          if (data.round_results) {
            console.log("🏆 Round results:", data.round_results);
            setLatestResults(data.round_results);
            setTimeout(() => setLatestResults(null),              // ← auto-clear
           3500);
          }

          // Handle simultaneous game actions - UPDATED for new field names
          if (data.action) {
            console.log("🎯 Player action:", data)
            setGameState((prev) => {
              if (!prev) return prev

              const updated = { ...prev }

              if (data.action === "make_offer") {
                // Update the appropriate player's offer in current round state
                if (data.player_fingerprint === prev.player1Fingerprint) {
                  updated.currentRoundState = {
                    ...updated.currentRoundState,
                    player1OfferMade: true,
                    player1CoinsToKeep: data.coins_to_keep,
                    player1CoinsToOffer: data.coins_to_offer,
                    // Keep legacy field for backward compatibility
                    player1Offer: data.coins_to_offer,
                  }
                } else if (data.player_fingerprint === prev.player2Fingerprint) {
                  updated.currentRoundState = {
                    ...updated.currentRoundState,
                    player2OfferMade: true,
                    player2CoinsToKeep: data.coins_to_keep,
                    player2CoinsToOffer: data.coins_to_offer,
                    // Keep legacy field for backward compatibility
                    player2Offer: data.coins_to_offer,
                  }
                }
                console.log("💰 Offer made:", {
                  coinsToKeep: data.coins_to_keep,
                  coinsToOffer: data.coins_to_offer,
                  player: data.player_fingerprint
                })
              }

              if (data.action === "respond_to_offer") {
                // Update the appropriate response based on target_player
                if (data.player_fingerprint === prev.player1Fingerprint && data.target_player === "player_2") {
                  updated.currentRoundState = {
                    ...updated.currentRoundState,
                    player1ResponseMade: true,
                    player1Response: data.response,
                  }
                } else if (data.player_fingerprint === prev.player2Fingerprint && data.target_player === "player_1") {
                  updated.currentRoundState = {
                    ...updated.currentRoundState,
                    player2ResponseMade: true,
                    player2Response: data.response,
                  }
                }
                console.log("🤔 Response made:", data.response, "by player:", data.player_fingerprint, "to:", data.target_player)
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

        if (event.code === 4004) {
          setError("Match not found")
          console.log("🚫 Match not found - not attempting to reconnect")
          return
        }

        if (event.code === 4001) {
          // setError("Match terminated by server")
          setError("Match terminated")  
          setMatchTerminated(true)
          // setTerminationReason(event.reason || "timeout");
          setTerminationReason(event.reason || "timeout");
          console.log("🚫 Match terminated by server - not attempting to reconnect")
          return
        }

        if (matchTerminated) {
          console.log("🚫 Match terminated - not attempting to reconnect")
          return
        }

        if (event.code === 1000 || reconnectAttemptsRef.current >= maxReconnectAttempts) {
          console.log("🚫 Not attempting to reconnect")
          return
        }

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
    // console.log("🔌 Disconnecting WebSocket")
    console.log("🔌 Manual disconnect requested")

    // From now on never attempt to reconnect
    setMatchTerminated(true);        // <- blocks reconnect logic
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    
    connectionRef.current = "disconnected"
    reconnectAttemptsRef.current = maxReconnectAttempts
    
    if (socket && socket.readyState !== WebSocket.CLOSED) {
      // socket.close(1000, "Manual disconnect")
      socket.send(JSON.stringify({action:"leave", player_fingerprint:playerFingerprint}));
      socket.close(4001, "Client left match");
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

  useEffect(() => {
    if (matchId && playerFingerprint && !matchTerminated) {
      connect()
    }
    
    return () => {
        if (connectionRef.current === "connected") {
    disconnect();
  }
    }
  }, [matchId, playerFingerprint, matchTerminated])

  return {
    socket,
    gameState,
    latestResults,
    connectionStatus,
    error,
    matchTerminated,
    terminationReason,
    sendMessage,
    connect,
    disconnect,
  }
}