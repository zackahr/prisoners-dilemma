"use client"

import { useEffect } from "react"
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

  // Calculate the circle's stroke-dashoffset based on time left
  const calculateDashOffset = () => {
    const circumference = 2 * Math.PI * 45 // 45 is the radius
    const percentageComplete = timeLeft / 10
    return circumference * (1 - percentageComplete)
  }

  return (
    <div className="game-timer">
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle
          className="timer-background"
          cx="50"
          cy="50"
          r="45"
          fill="transparent"
          stroke="#e0e0e0"
          strokeWidth="5"
        />
        <circle
          className="timer-progress"
          cx="50"
          cy="50"
          r="45"
          fill="transparent"
          stroke={timeLeft <= 3 ? "#ff4d4d" : "#4caf50"}
          strokeWidth="5"
          strokeDasharray={2 * Math.PI * 45}
          strokeDashoffset={calculateDashOffset()}
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
        />
        <text
          x="50"
          y="55"
          textAnchor="middle"
          fontSize="24"
          fontWeight="bold"
          fill={timeLeft <= 3 ? "#ff4d4d" : "#4caf50"}
        >
          {timeLeft}s
        </text>
      </svg>
    </div>
  )
}

export default GameTimer
