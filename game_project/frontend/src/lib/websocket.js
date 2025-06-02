// WebSocket utility for real-time game communication with Django backend
export class GameWebSocket {
    constructor(gameId, playerId, onMessage, onConnect = () => {}, onDisconnect = () => {}) {
      this.ws = null
      // Replace with your Django WebSocket URL
      // this.url = `ws://localhost:8000/ws/game/${gameId}/?player_id=${playerId}`
      this.url = `ws://localhost:8000/ws/ultimatum/${gameId}/?player_id=${playerId}`
      this.onMessage = onMessage
      this.onConnect = onConnect
      this.onDisconnect = onDisconnect
    }
  
    connect() {
      try {
        this.ws = new WebSocket(this.url)
  
        this.ws.onopen = () => {
          console.log("WebSocket connected")
          this.onConnect()
        }
  
        this.ws.onmessage = (event) => {
          const data = JSON.parse(event.data)
          this.onMessage(data)
        }
  
        this.ws.onclose = () => {
          console.log("WebSocket disconnected")
          this.onDisconnect()
        }
  
        this.ws.onerror = (error) => {
          console.error("WebSocket error:", error)
        }
      } catch (error) {
        console.error("Failed to connect WebSocket:", error)
      }
    }
  
    sendMessage(message) {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(message))
      }
    }
  
    disconnect() {
      if (this.ws) {
        this.ws.close()
        this.ws = null
      }
    }
  }
  
  // API utility functions for Django backend
  export const gameAPI = {
    // Join matchmaking queue
    joinQueue: async (playerId) => {
      const response = await fetch("/api/ultimatum/create_match/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
         body: JSON.stringify({
             player_fingerprint: playerId,
             game_mode: "online"
           }),
      })
      return response.json()
    },
  
    // Leave matchmaking queue
    // leaveQueue: async (playerId) => {
    //   const response = await fetch("/api/ultimatum/matchmaking/leave", {
    //     method: "POST",
    //     headers: { "Content-Type": "application/json" },
    //     body: JSON.stringify({ player_id: playerId }),
    //   })
    //   return response.json()
    // },
  
    // Submit game offer
    submitOffer: async (gameId, playerId, offer) => {
      // const response = await fetch("/api/ultimatum/offer", {
        const response = await fetch("/api/ultimatum/offer/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // game_id: gameId,
          match_id: gameId,
          player_id: playerId,
          offer,
        }),
      })
      return response.json()
    },
  
    // Submit response to offer
    submitResponse: async (gameId, playerId, accepted) => {
      const response = await fetch("/api/ultimatum/response/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          match_id: gameId,
          player_id: playerId,
          accepted,
        }),
      })
      return response.json()
    },
  
    // Get game state
    getGameState: async (gameId) => {
      const response = await fetch(`/api/ultimatum/${gameId}/`)
      return response.json()
    },
  }
  