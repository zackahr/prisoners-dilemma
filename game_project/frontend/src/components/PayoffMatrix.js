import "./PayoffMatrix.css"

function PayoffMatrix() {
  return (
    <div className="payoff-matrix">
      <table>
        <thead>
          <tr>
            <th></th>
            <th>Player 2 Choice</th>
            <th>Player 2 Choice</th>
          </tr>
          <tr>
            <th></th>
            <th>Cooperate</th>
            <th>Defect</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="player-action">
              Player 1 Choice
              <br />
              Cooperate
            </td>
            <td className="payoff">20, 20</td>
            <td className="payoff">0, 30</td>
          </tr>
          <tr>
            <td className="player-action">
              Player 1 Choice
              <br />
              Defect
            </td>
            <td className="payoff">30, 0</td>
            <td className="payoff">10, 10</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

export default PayoffMatrix
