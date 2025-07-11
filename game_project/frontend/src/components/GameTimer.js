import { useEffect } from "react"
import "./GameTimer.css"

function GameTimer({ timeLeft, setTimeLeft, canMakeChoice, onTimeUp }) {
  useEffect(() => {
    if (!canMakeChoice) return

    if (timeLeft <= 0) {
      onTimeUp()
      return
    }

    const timerId = setInterval(() => {
      setTimeLeft((prevTime) => prevTime - 1)
    }, 1000)

    return () => clearInterval(timerId)
  }, [timeLeft, canMakeChoice, setTimeLeft, onTimeUp])

  const radius = 45
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (timeLeft / 15) * circumference

  return (
    <div className="timer-circle-container">
      <svg className="timer-svg" width="120" height="120" viewBox="0 0 100 100">
        <circle className="timer-circle-bg" cx="50" cy="50" r={radius} />
        <circle
          className="timer-circle-progress"
          cx="50"
          cy="50"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
        />
      </svg>
      <div className="timer-text-container">
        <div className="timer-time">{timeLeft}</div>
        <div className="timer-label">SECONDS</div>
      </div>
    </div>
  )
}

export default GameTimer
