"use client"

import { useEffect } from "react"
import { Clock } from "lucide-react"
import "./GameTimer.css"

function GameTimer({ timeLeft, setTimeLeft, canMakeChoice, onTimeUp }) {
  useEffect(() => {
    let timer

    if (canMakeChoice && timeLeft > 0) {
      timer = setTimeout(() => {
        setTimeLeft(timeLeft - 1)
      }, 1000)
    } else if (timeLeft === 0 && canMakeChoice) {
      onTimeUp()
    }

    return () => {
      clearTimeout(timer)
    }
  }, [timeLeft, canMakeChoice, setTimeLeft, onTimeUp])

  const circumference = 2 * Math.PI * 45
  const strokeDashoffset = circumference - (timeLeft / 10) * circumference

  return (
    <div className="game-timer">
      <div className="timer-container">
        <svg className="timer-svg" width="120" height="120">
          <circle
            className="timer-track"
            cx="60"
            cy="60"
            r="45"
            fill="none"
            stroke="rgba(255, 255, 255, 0.2)"
            strokeWidth="6"
          />
          <circle
            className="timer-progress"
            cx="60"
            cy="60"
            r="45"
            fill="none"
            stroke="url(#timerGradient)"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            transform="rotate(-90 60 60)"
          />
          <defs>
            <linearGradient id="timerGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="50%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#ef4444" />
            </linearGradient>
          </defs>
        </svg>

        <div className="timer-content">
          <Clock className="timer-icon" />
          <div className="timer-text">{timeLeft}</div>
          <div className="timer-label">seconds</div>
        </div>
      </div>
    </div>
  )
}

export default GameTimer
