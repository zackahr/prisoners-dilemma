// PayoffsTable.js
import "./PayoffsTable.css";

export default function PayoffsTable({ history }) {
  const rounds = Array.from({ length: 25 }, (_, i) => i + 1);

  const val = (round, player) => {
    const r = history.find((h) => h.roundNumber === round);
    return r ? (player === 1 ? r.player1Points : r.player2Points) : "";
  };

  // Calculate total scores for each player
  const getPlayerTotal = (player) => {
    return history
      .filter(r => r.roundNumber <= 25) // Only count completed rounds
      .reduce((total, round) => {
        const points = player === 1 ? round.player1Points : round.player2Points;
        return total + (points || 0);
      }, 0);
  };

  return (
    <>
      {/* ------------- title ABOVE the glass panel ------------- */}
      <h3 className="payoffs-title">Payoffs Table</h3>

      <div className="payoffs-wrapper">
        <table className="payoffs-table">
          <thead>
            <tr>
              <th>Player</th>
              {rounds.map((r) => (
                <th key={r}>{r}</th>
              ))}
              <th className="total-column">Total</th>
            </tr>
          </thead>

          <tbody>
            {[1, 2].map((p) => (
              <tr key={p}>
                <td className="player-label">{`Player ${p}`}</td>
                {rounds.map((r) => (
                  <td key={r}>{val(r, p)}</td>
                ))}
                <td className="total-cell">{getPlayerTotal(p)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
