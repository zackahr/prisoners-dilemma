import "./RoundHistory.css"

function RoundHistory({ history }) {
  return (
    <div className="round-history">
      <h3>Round History</h3>

      {history.length === 0 ? (
        <p>No rounds played yet</p>
      ) : (
        <div className="history-table-container">
          <table className="history-table">
            <thead>
              <tr>
                <th>Round</th>
                <th>Your Choice</th>
                <th>Opponent's Choice</th>
                <th>Your Points</th>
                <th>Opponent's Points</th>
              </tr>
            </thead>
            <tbody>
              {history.map((round) => (
                <tr key={round.roundNumber}>
                  <td>{round.roundNumber}</td>
                  <td className={round.playerAction === "Cooperate" ? "cooperate" : "defect"}>{round.playerAction}</td>
                  <td className={round.opponentAction === "Cooperate" ? "cooperate" : "defect"}>
                    {round.opponentAction}
                  </td>
                  <td>{round.playerPoints}</td>
                  <td>{round.opponentPoints}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {history.length > 0 && (
        <div className="totals">
          <p>
            <strong>Total Points:</strong> You: {history.reduce((sum, round) => sum + round.playerPoints, 0)}, Opponent:{" "}
            {history.reduce((sum, round) => sum + round.opponentPoints, 0)}
          </p>
        </div>
      )}
    </div>
  )
}

export default RoundHistory
