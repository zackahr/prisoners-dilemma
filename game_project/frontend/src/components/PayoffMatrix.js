import "./PayoffMatrix.css"

function PayoffMatrix() {
  return (
    <div className="payoff-matrix">
      <table>
        <thead>
          <tr>
            <th></th>
            <th>Opponent Cooperates</th>
            <th>Opponent Defects</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="player-action">You Cooperate</td>
            <td className="payoff">20, 20</td>
            <td className="payoff">0, 30</td>
          </tr>
          <tr>
            <td className="player-action">You Defect</td>
            <td className="payoff">30, 0</td>
            <td className="payoff">10, 10</td>
          </tr>
        </tbody>
      </table>

      <div className="payoff-reminder">
        <h4>Score Reminder</h4>
        <p>First number is your score, second number is opponent's score</p>
      </div>
    </div>
  )
}

export default PayoffMatrix
