import "./RoundHistory.css"

function RoundHistory({ history, isPlayer1 }) {
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
                  <td
                    className={
                      isPlayer1
                        ? round.player1Action === "Cooperate"
                          ? "cooperate"
                          : "defect"
                        : round.player2Action === "Cooperate"
                          ? "cooperate"
                          : "defect"
                    }
                  >
                    {isPlayer1 ? round.player1Action : round.player2Action}
                  </td>
                  <td
                    className={
                      isPlayer1
                        ? round.player2Action === "Cooperate"
                          ? "cooperate"
                          : "defect"
                        : round.player1Action === "Cooperate"
                          ? "cooperate"
                          : "defect"
                    }
                  >
                    {isPlayer1 ? round.player2Action : round.player1Action}
                  </td>
                  <td>{isPlayer1 ? round.player1Points : round.player2Points}</td>
                  <td>{isPlayer1 ? round.player2Points : round.player1Points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {history.length > 0 && (
        <div className="totals">
          <p>
            <strong>Total Points:</strong> You:{" "}
            {isPlayer1
              ? history.reduce((sum, round) => sum + round.player1Points, 0)
              : history.reduce((sum, round) => sum + round.player2Points, 0)}
            , Opponent:{" "}
            {isPlayer1
              ? history.reduce((sum, round) => sum + round.player2Points, 0)
              : history.reduce((sum, round) => sum + round.player1Points, 0)}
          </p>
        </div>
      )}
    </div>
  )
}

export default RoundHistory
