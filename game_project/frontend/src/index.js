
import React, { useState, useEffect } from "react"
import ReactDOM from "react-dom/client"
import { BrowserRouter, Routes, Route } from "react-router-dom"

import "./index.css"
import "./App.css"
import reportWebVitals from "./reportWebVitals"
import Modal from "./components/Modal"
import HomePage from "./HomePage"

// Prisoner's Dilemma game
import PrisonersApp from "./prisoners/PrisonersApp"

// Ultimatum game
import RootLayout from "./ultimatum/RootLayout"
import UltimatumHome from "./ultimatum/HomePage"
import UltimatumGame from "./ultimatum/GamePage"
import UltimatumMatchmaking from "./ultimatum/MatchmakingPage"

function GlobalModalBus() {
  const [payload, setPayload] = useState({ open: false })

  useEffect(() => {
    const handler = (e) => setPayload({ open: true, ...e.detail })
    window.addEventListener("GLOBAL_MODAL", handler)
    return () => window.removeEventListener("GLOBAL_MODAL", handler)
  }, [])

  if (!payload.open) return null

  return <Modal open title={payload.title} message={payload.msg} onClose={() => setPayload({ open: false })} />
}

const root = ReactDOM.createRoot(document.getElementById("root"))
root.render(
  <React.StrictMode>
    <GlobalModalBus />
    <BrowserRouter>
      <Routes>
        {/* Home landing page */}
        <Route path="/" element={<HomePage />} />

        {/* Prisoner's Dilemma App */}
        <Route path="/prisoners/*" element={<PrisonersApp />} />

        {/* Ultimatum Game Routes */}
        <Route
          path="/ultimatum"
          element={
            <RootLayout>
              <UltimatumHome />
            </RootLayout>
          }
        />
        <Route
          path="/ultimatum/matchmaking"
          element={
            <RootLayout>
              <UltimatumMatchmaking />
            </RootLayout>
          }
        />
        <Route
          path="/ultimatum/game"
          element={
            <RootLayout>
              <UltimatumGame />
            </RootLayout>
          }
        />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)

reportWebVitals()
