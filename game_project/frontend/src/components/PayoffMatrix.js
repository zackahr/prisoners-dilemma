import "./PayoffMatrix.css"

function PayoffMatrix() {
  return (
    <div className="payoff-matrix-container">
      <div className="payoff-matrix">
        <div className="matrix-header">
          <div className="matrix-corner"></div>
          <div className="matrix-col-header">
            <div className="player-label">Player 2</div>
            <div className="action-labels">
              <span className="action-cooperate">Cooperate</span>
              <span className="action-defect">Defect</span>
            </div>
          </div>
        </div>

        <div className="matrix-body">
          <div className="matrix-row-header">
            <div className="player-label vertical">Player 1</div>
            <div className="action-labels vertical">
              <span className="action-cooperate">Cooperate</span>
              <span className="action-defect">Defect</span>
            </div>
          </div>

          <div className="matrix-cells">
            <div className="matrix-row">
              <div className="payoff-cell cooperate-cooperate">
                <div className="payoff-values">
                  <span className="player1-payoff">20</span>
                  <span className="payoff-separator">,</span>
                  <span className="player2-payoff">20</span>
                </div>
                <div className="payoff-label">Mutual Cooperation</div>
              </div>
              <div className="payoff-cell cooperate-defect">
                <div className="payoff-values">
                  <span className="player1-payoff">0</span>
                  <span className="payoff-separator">,</span>
                  <span className="player2-payoff">30</span>
                </div>
                <div className="payoff-label">Sucker's Payoff</div>
              </div>
            </div>

            <div className="matrix-row">
              <div className="payoff-cell defect-cooperate">
                <div className="payoff-values">
                  <span className="player1-payoff">30</span>
                  <span className="payoff-separator">,</span>
                  <span className="player2-payoff">0</span>
                </div>
                <div className="payoff-label">Temptation</div>
              </div>
              <div className="payoff-cell defect-defect">
                <div className="payoff-values">
                  <span className="player1-payoff">10</span>
                  <span className="payoff-separator">,</span>
                  <span className="player2-payoff">10</span>
                </div>
                <div className="payoff-label">Mutual Defection</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="payoff-legend">
        <div className="legend-item">
          <div className="legend-color best"></div>
          <span>Best outcome (30 points)</span>
        </div>
        <div className="legend-item">
          <div className="legend-color good"></div>
          <span>Good outcome (20 points)</span>
        </div>
        <div className="legend-item">
          <div className="legend-color poor"></div>
          <span>Poor outcome (10 points)</span>
        </div>
        <div className="legend-item">
          <div className="legend-color worst"></div>
          <span>Worst outcome (0 points)</span>
        </div>
      </div>
    </div>
  )
}

export default PayoffMatrix
