//  src/components/PayoffsTable.jsx
import "./PayoffsTable.css";

/** how many rounds we play **/
const TOTAL_ROUNDS = 25;

/**
 * history example
 * [
 *   { roundNumber : 1, player1Offer : 30, player2Offer : 40 },
 *   { roundNumber : 2, player1Offer : 25, player2Offer : 25 },
 *   ...
 * ]
 */
export default function PayoffsTable({ history }) {
  const rounds = Array.from({ length: TOTAL_ROUNDS }, (_, i) => i + 1);

  /** returns the *offer* for <player> in <round>, or "" if that round not played yet */
  const offer = (round, player) => {
    const rec = history.find(h => h.roundNumber === round);
    if (!rec) return "";
    return player === 1 ? rec.player1Offer ?? "" : rec.player2Offer ?? "";
  };

  return (
    <>
      <h3 className="payoffs-title">Payoffs Table</h3>

      <div className="payoffs-wrapper">
        <table className="payoffs-table">
          <thead>
            <tr>
              <th className="player-col">Player</th>
              {rounds.map(r => (
                <th key={r}>{r}</th>
              ))}
            </tr>
          </thead>

          <tbody>
            {[1, 2].map(p => (
              <tr key={p}>
                <td className="player-label">{`Player ${p}`}</td>
                {rounds.map(r => (
                  <td key={r}>{offer(r, p)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
