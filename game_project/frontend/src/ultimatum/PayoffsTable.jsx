
import "./PayoffsTable.css"

const TOTAL_ROUNDS = 25

export default function PayoffsTable({ history }) {
  console.log("📊 PayoffsTable received history:", history)

  const rounds = Array.from({ length: TOTAL_ROUNDS }, (_, i) => i + 1)

  const getRoundData = (roundNumber) => {
    const roundData = history.find((h) => h.roundNumber === roundNumber)
    console.log(`📊 Round ${roundNumber} data:`, roundData)
    return roundData
  }

  const getPlayerOffer = (roundNumber, playerNumber) => {
    const roundData = getRoundData(roundNumber)
    if (!roundData) return ""

    // Check if this round data has the offer information
    if (roundData.offer !== undefined && roundData.proposerFingerprint) {
      // This is the new format from WebSocket
      return roundData.proposerFingerprint.includes(`player${playerNumber}`) ? roundData.offer : ""
    }

    // Fallback to old format
    return playerNumber === 1 ? (roundData.player1Offer ?? "") : (roundData.player2Offer ?? "")
  }

  const getPlayerEarnings = (roundNumber, playerNumber) => {
    const roundData = getRoundData(roundNumber)
    if (!roundData) return ""

    // New format from WebSocket
    if (roundData.player1Earned !== undefined) {
      return playerNumber === 1 ? roundData.player1Earned : roundData.player2Earned
    }

    // Calculate from offer and response
    if (roundData.offer !== undefined && roundData.response) {
      const accepted = roundData.response === "accept"
      if (!accepted) return 0

      // Determine if this player was proposer or responder
      const wasProposer = roundData.proposerFingerprint?.includes(`player${playerNumber}`)
      return wasProposer ? 100 - roundData.offer : roundData.offer
    }

    return ""
  }

  return (
    <>
      <h3 className="payoffs-title">Game History</h3>

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
