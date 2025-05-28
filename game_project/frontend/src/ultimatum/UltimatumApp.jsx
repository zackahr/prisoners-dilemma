"use client"

import { useState } from "react"
import HomePage from "./HomePage"
import MatchmakingPage from "./MatchmakingPage"
import GamePage from "./GamePage"
import Loading from "./Loading"

export default function UltimatumApp() {
  const [currentPage, setCurrentPage] = useState("home") // 'home' | 'matchmaking' | 'game' | 'loading'
  const [gameMode, setGameMode] = useState("online") // 'online' | 'bot'

  const handleStartGame = (mode) => {
    setGameMode(mode)
    if (mode === "online") {
      setCurrentPage("matchmaking")
    } else {
      setCurrentPage("game")
    }
  }

  const handleGameFound = () => {
    setCurrentPage("game")
  }

  const handleCancelMatchmaking = () => {
    setCurrentPage("home")
  }

  const handleGameEnd = () => {
    if (gameMode === "online") {
      setCurrentPage("matchmaking")
    } else {
      setCurrentPage("home")
    }
  }

  const handleBackToMenu = () => {
    setCurrentPage("home")
  }

  const renderCurrentPage = () => {
    switch (currentPage) {
      case "home":
        return <HomePage onStartGame={handleStartGame} />
      case "matchmaking":
        return <MatchmakingPage onGameFound={handleGameFound} onCancel={handleCancelMatchmaking} />
      case "game":
        return <GamePage gameMode={gameMode} onGameEnd={handleGameEnd} onBackToMenu={handleBackToMenu} />
      case "loading":
        return <Loading />
      default:
        return <HomePage onStartGame={handleStartGame} />
    }
  }

  return <div className="ultimatum-app">{renderCurrentPage()}</div>
}
