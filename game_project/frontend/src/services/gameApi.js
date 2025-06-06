const API_BASE_URL = "http://localhost:8001/api/ultimatum"

export const gameApi = {
  async createMatch(gameMode, playerFingerprint) {
    console.log("🎮 Creating match:", { gameMode, playerFingerprint })

    try {
      const response = await fetch(`${API_BASE_URL}/create-match-ultimatum/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          game_mode: gameMode,
          player_fingerprint: playerFingerprint,
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      console.log("✅ Match created/joined:", data)
      return data
    } catch (error) {
      console.error("❌ Error creating match:", error)
      throw error
    }
  },

  async getMatchStats(matchId) {
    console.log("📊 Getting match stats for:", matchId)

    try {
      const response = await fetch(`${API_BASE_URL}/match-stats/${matchId}/`)

      if (!response.ok) {
        if (response.status === 404) {
          console.log("⚠️ Match not found")
          throw new Error("Match not found")
        }
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      console.log("📊 Match stats:", data)
      return data
    } catch (error) {
      console.error("❌ Error getting match stats:", error)
      throw error
    }
  },

  async getMatchHistory(matchId) {
    console.log("📜 Getting match history for:", matchId)

    try {
      const response = await fetch(`${API_BASE_URL}/match-history/${matchId}/`)

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      console.log("📜 Match history:", data)
      return data
    } catch (error) {
      console.error("❌ Error getting match history:", error)
      throw error
    }
  },
}

export const generatePlayerFingerprint = () => {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 15)
  const fingerprint = `player_${timestamp}_${random}`
  console.log("👤 Generated player fingerprint:", fingerprint)
  return fingerprint
}

export const getPlayerFingerprint = () => {
  const storageKey = 'ultimatum_player_fingerprint'
  
  let fingerprint = localStorage.getItem(storageKey)
  
  if (!fingerprint) {
    fingerprint = generatePlayerFingerprint()
    localStorage.setItem(storageKey, fingerprint)
    console.log("💾 Saved new fingerprint to localStorage:", fingerprint)
  } else {
    console.log("🔄 Using existing fingerprint from localStorage:", fingerprint)
  }
  
  return fingerprint
}

export const clearPlayerFingerprint = () => {
  const storageKey = 'ultimatum_player_fingerprint'
  localStorage.removeItem(storageKey)
  console.log("🗑️ Cleared player fingerprint from localStorage")
}