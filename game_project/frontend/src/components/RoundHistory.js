import { Trophy, Target, Shield, Zap } from "lucide-react"
import "./RoundHistory.css"

function RoundHistory({ history, isPlayer1 }) {
  if (history.length === 0) {
    return (
      <div className="round-history">
        <div className="history-header">
          <Trophy className="history-icon" />
          <h3 className="history-title">Round History</h3>
        </div>
        <div className="no-history">
          <Target className="no-history-icon" />
          <p>No rounds played yet</p>
        </div>
      </div>
    )
  }

  const totalMyPoints = history.reduce((sum, round) => sum + (isPlayer1 ? round.player1Points : round.player2Points), 0)

  const totalOpponentPoints = history.reduce(
    (sum, round) => sum + (isPlayer1 ? round.player2Points : round.player1Points),
    0,
  )

  const myCooperations = history.filter((round) =>
    isPlayer1 ? round.player1Action === "Cooperate" : round.player2Action === "Cooperate",
  ).length

  const cooperationRate = history.length > 0 ? Math.round((myCooperations / history.length) * 100) : 0

  return (
    <div className="round-history">
      <div className="history-header">
        <Trophy className="history-icon" />
        <h3 className="history-title">Round History</h3>
      </div>

      <div className="history-stats">
        <div className="stat-card">
          <div className="stat-icon-container">
            <Target className="stat-icon" />
          </div>
          <div className="stat-content">
            <div className="stat-value">{totalMyPoints}</div>
            <div className="stat-label">Your Points</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-container">
            <Trophy className="stat-icon" />
          </div>
          <div className="stat-content">
            <div className="stat-value">{totalOpponentPoints}</div>
            <div className="stat-label">Opponent Points</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-container">
            <Shield className="stat-icon" />
          </div>
          <div className="stat-content">
            <div className="stat-value">{cooperationRate}%</div>
            <div className="stat-label">Cooperation Rate</div>
          </div>
        </div>
      </div>

      <div className="history-table-container">
        <table className="history-table">
          <thead>
            <tr>
              <th>Round</th>
              <th>Your Choice</th>
              <th>Opponent</th>
              <th>Your Points</th>
              <th>Opp. Points</th>
              <th>Outcome</th>
            </tr>
          </thead>
          <tbody>
            {history.map((round) => {
              const myAction = isPlayer1 ? round.player1Action : round.player2Action
              const opponentAction = isPlayer1 ? round.player2Action : round.player1Action
              const myPoints = isPlayer1 ? round.player1Points : round.player2Points
              const opponentPoints = isPlayer1 ? round.player2Points : round.player1Points

              let outcomeClass = ""
              let outcomeIcon = null
              let outcomeText = ""

              if (myPoints > opponentPoints) {
                outcomeClass = "outcome-win"
                outcomeIcon = <Trophy className="outcome-icon" />
                outcomeText = "Win"
              } else if (myPoints < opponentPoints) {
                outcomeClass = "outcome-lose"
                outcomeIcon = <Zap className="outcome-icon" />
                outcomeText = "Lose"
              } else {
                outcomeClass = "outcome-tie"
                outcomeIcon = <Shield className="outcome-icon" />
                outcomeText = "Tie"
              }

              return (
                <tr key={round.roundNumber} className="history-row">
                  <td className="round-number">{round.roundNumber}</td>
                  <td className={`action-cell ${myAction === "Cooperate" ? "cooperate" : "defect"}`}>
                    <div className="action-content">
                      {myAction === "Cooperate" ? <Shield className="action-icon" /> : <Zap className="action-icon" />}
                      {myAction}
                    </div>
                  </td>
                  <td className={`action-cell ${opponentAction === "Cooperate" ? "cooperate" : "defect"}`}>
                    <div className="action-content">
                      {opponentAction === "Cooperate" ? (
                        <Shield className="action-icon" />
                      ) : (
                        <Zap className="action-icon" />
                      )}
                      {opponentAction}
                    </div>
                  </td>
                  <td className="points-cell my-points">{myPoints}</td>
                  <td className="points-cell opponent-points">{opponentPoints}</td>
                  <td className={`outcome-cell ${outcomeClass}`}>
                    <div className="outcome-content">
                      {outcomeIcon}
                      {outcomeText}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default RoundHistory
