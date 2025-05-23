"use client"

import { useState } from "react"
import { BrowserRouter as Router, Routes, Route } from "react-router-dom"
import Header from "./components/Header"
import GameRules from "./components/GameRules"
import GameBoard from "./components/GameBoard"
import GameBoard from "./components/ResultsPage"
import "./App.css"

function App() {
  const [matchId, setMatchId] = useState(null)
  const [playerFingerprint, setPlayerFingerprint] = useState(null)

  return (
    <Router>
      <div className="app">
        <Header />
        <div className="container">
          <Routes>
            <Route
              path="/"
              element={<GameRules setMatchId={setMatchId} setPlayerFingerprint={setPlayerFingerprint} />}
            />
            <Route path="/game/:matchId" element={<GameBoard playerFingerprint={playerFingerprint} />} />
            <Route path="/results/:matchId" element={<ResultsPage />} />

          </Routes>
        </div>
      </div>
    </Router>
  )
}

export default App
