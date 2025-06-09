import "./PayoffsTable.css"

const TOTAL_ROUNDS = 25

export default function PayoffsTable({ history }) {
  const rounds = Array.from({ length: TOTAL_ROUNDS }, (_, i) => i + 1)

  const getRoundData = (roundNumber) => {
    return history.find((h) => h.roundNumber === roundNumber)
  }

  const getPlayerOffer = (roundNumber, playerNumber) => {
    const roundData = getRoundData(roundNumber)
    if (!roundData) return ""
    
    return playerNumber === 1 ? (roundData.player1Offer ?? "") : (roundData.player2Offer ?? "")
  }

  const getPlayerResponse = (roundNumber, playerNumber) => {
    const roundData = getRoundData(roundNumber)
    if (!roundData) return ""
    
    if (playerNumber === 1) {
      return roundData.player1ResponseToP2 ? (roundData.player1ResponseToP2 === "accept" ? "✓" : "✗") : ""
    } else {
      return roundData.player2ResponseToP1 ? (roundData.player2ResponseToP1 === "accept" ? "✓" : "✗") : ""
    }
  }

  const getPlayerEarnings = (roundNumber, playerNumber) => {
    const roundData = getRoundData(roundNumber)
    if (!roundData) return ""

    return playerNumber === 1 ? (roundData.player1Earned ?? "") : (roundData.player2Earned ?? "")
  }

  return (
    <>
      <h3 className="payoffs-title">Game History - Simultaneous Play</h3>

      <div className="payoffs-wrapper">
        <table className="payoffs-table">
          <thead>
            <tr>
              <th className="player-col">Round</th>
              {rounds.map((r) => (
                <th key={r} className="round-col">
                  {r}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            <tr>
              <td className="player-label">P1 Offer</td>
              {rounds.map((r) => (
                <td key={r} className="offer-cell">
                  {getPlayerOffer(r, 1)}
                </td>
              ))}
            </tr>
            <tr>
              <td className="player-label">P2 Offer</td>
              {rounds.map((r) => (
                <td key={r} className="offer-cell">
                  {getPlayerOffer(r, 2)}
                </td>
              ))}
            </tr>
            <tr>
              <td className="player-label">P1 Response</td>
              {rounds.map((r) => (
                <td key={r} className="response-cell">
                  {getPlayerResponse(r, 1)}
                </td>
              ))}
            </tr>
            <tr>
              <td className="player-label">P2 Response</td>
              {rounds.map((r) => (
                <td key={r} className="response-cell">
                  {getPlayerResponse(r, 2)}
                </td>
              ))}
            </tr>
            <tr>
              <td className="player-label">P1 Earned</td>
              {rounds.map((r) => (
                <td key={r} className="earnings-cell">
                  {getPlayerEarnings(r, 1)}
                </td>
              ))}
            </tr>
            <tr>
              <td className="player-label">P2 Earned</td>
              {rounds.map((r) => (
                <td key={r} className="earnings-cell">
                  {getPlayerEarnings(r, 2)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </>
  )
}