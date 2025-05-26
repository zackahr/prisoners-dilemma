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

  return (
    <div className="game-timer">
      <div className="timer-circle">
        <div className="timer-text">{timeLeft}s</div>
      </div>
    </div>
  )
}

export default GameTimer
