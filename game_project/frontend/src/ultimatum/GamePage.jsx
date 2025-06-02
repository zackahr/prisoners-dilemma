// import { useState, useEffect, useCallback } from "react";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  Clock,
  DollarSign,
  CheckCircle,
  XCircle,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { wsUrl } from "./wsUrl";
import PayoffsTable from "./PayoffsTable";    //  ← NEW
import "./GamePage.css";
// helper to pop nice modals (you already have the bus)
const pop = (title, msg) =>
  window.dispatchEvent(new CustomEvent("GLOBAL_MODAL", { detail: { title, msg } }));
const MAX_ROUNDS  = 25;
const TOTAL_MONEY = 100;

export default function GamePage() {
  const navigate       = useNavigate();
  const [searchParams] = useSearchParams();
  // const gameMode       = searchParams.get("mode") || "online";
  const matchId    = searchParams.get("match");
const fingerprint = searchParams.get("fp");

  /* ─────────────────────────────────────────────────────────
     ROUND STATE (only current round)
  ───────────────────────────────────────────────────────── */
  const [round, setRound] = useState({
    phase            : "proposing",   // proposing | waiting | responding | result
    myOffer          : 0,
    opponentOffer    : 0,
    myResponse       : null,          // accepted | rejected | null
    opponentResponse : null,
    resultCode       : null,
    timeLeft         : 30,
  });

  /* ─────────────────────────────────────────────────────────
     MATCH-LEVEL STATE (persists across rounds)
  ───────────────────────────────────────────────────────── */
  const [roundNumber, setRoundNumber] = useState(1);
  const [history, setHistory]         = useState([]);   // [{ roundNumber, player1Points, player2Points }]

  /* input field */
  const [inputOffer, setInputOffer] = useState("");

/* ─────────── WS setup ─────────── */
const wsRef = useRef(null);

useEffect(() => {
  if (!matchId || !fingerprint) return;

  // const url = `ws://${window.location.host}/ws/ultimatum-game/${matchId}/`;
  // const ws  = new WebSocket(url);
  const url = wsUrl(matchId);
  const ws  = new WebSocket(url);
  wsRef.current = ws;

  ws.onopen = () =>
    ws.send(JSON.stringify({ action: "join", player_fingerprint: fingerprint }));

  ws.onmessage = ({ data }) => {
    const msg = JSON.parse(data);

    /* ---- GAME STATE (full snapshot) ---- */
    if (msg.game_state) {
      const gs = msg.game_state;

      /* waiting for P2 to join */
      if (gs.waitingForOpponent) {
        setRound(r => ({ ...r, phase: "waiting_for_player" }));
        return;
      }

      /* initialise / new round */
      setRoundNumber(gs.currentRound);
      if (gs.currentRoundState.offerMade) {
        setRound({
          phase            : gs.currentRoundState.responseMade ? "result" : "responding",
          myOffer          : gs.currentRoundState.offer        ?? 0,
          opponentOffer    : gs.currentRoundState.offer        ?? 0,
          myResponse       : gs.currentRoundState.response,
          opponentResponse : gs.currentRoundState.response,
          resultCode       : null,
          timeLeft         : 30,
        });
      } else {
        setRound(r => ({ ...r, phase: "proposing", timeLeft: 30 }));
      }

      /* update history */
      setHistory(
        gs.roundHistory.map(h => ({
          roundNumber : h.roundNumber,
          player1Offer: h.offer,
          player2Offer: h.offer, // we only store offers for grid
        }))
      );
      return;
    }

    /* ---- INDIVIDUAL GAME ACTION ---- */
    if (msg.action === "make_offer") {
      if (msg.player_fingerprint === fingerprint) return; // already optimistic
      setRound(r => ({
        ...r,
        opponentOffer: msg.offer,
        phase        : "responding",
        timeLeft     : 30,
      }));
    }

    if (msg.action === "respond_to_offer") {
      if (msg.player_fingerprint === fingerprint) return;
      const accepted = msg.response === "accept";
      setRound(r => ({
        ...r,
        opponentResponse: accepted ? "accepted" : "rejected",
        phase           : "result",
      }));
    }

    /* ---- GAME OVER / ABORT ---- */
    if (msg.game_aborted) {
      pop("Game cancelled", msg.message);
      navigate("/ultimatum");
    }
    if (msg.game_over) {
      pop("Match completed",
          `Final score – P1 ${msg.player1_score} : P2 ${msg.player2_score}`);
      navigate("/ultimatum");
    }
  };

  ws.onclose = () => console.log("WS closed");
  ws.onerror = () => console.log("WS error");

  return () => ws.close();
}, [matchId, fingerprint, navigate]);
  /* ─────────────────────────────────────────────────────────
     TIMER
  ───────────────────────────────────────────────────────── */
  useEffect(() => {
    if (round.timeLeft <= 0) return;

    if (["proposing", "responding", "waiting"].includes(round.phase)) {
      const t = setTimeout(
        () => setRound(r => ({ ...r, timeLeft: r.timeLeft - 1 })),
        1000
      );
      return () => clearTimeout(t);
    }
  }, [round.timeLeft, round.phase]);

  /* ─────────────────────────────────────────────────────────
     HELPERS
  ───────────────────────────────────────────────────────── */
  const earningsForRound = (myOffer, oppOffer, myAcc, oppAcc) => {
    if (myAcc && oppAcc) {
      return {
        me : TOTAL_MONEY - myOffer + oppOffer,
        op : TOTAL_MONEY - oppOffer + myOffer,
      };
    }
    return { me: 0, op: 0 };
  };


  const submitOffer = () => {
    if (!wsRef.current) return;
    const offer = Math.max(0, Math.min(+inputOffer || 0, TOTAL_MONEY));
    setRound(r => ({ ...r, phase: "waiting", myOffer: offer, timeLeft: 30 }));
  
    wsRef.current.send(
      JSON.stringify({
        action            : "make_offer",
        player_fingerprint: fingerprint,
        offer,
      })
    );
  };

  const respond = (accepted) => {
    if (!wsRef.current) return;
    setRound(r => ({ ...r, myResponse: accepted ? "accepted" : "rejected", phase: "waiting", timeLeft: 30 }));

    wsRef.current.send(
      JSON.stringify({
        action            : "respond_to_offer",
        player_fingerprint: fingerprint,
        response          : accepted ? "accept" : "reject",
      })
    );
  };
  /* ─────────────────────────────────────────────────────────
     NEXT ROUND  /  FINISH MATCH
  ───────────────────────────────────────────────────────── */
  const startNextRound = () => {
    if (roundNumber >= MAX_ROUNDS) {
      navigate("/ultimatum");          // or show a final scoreboard page
      return;
    }

    setRoundNumber(n => n + 1);
    setInputOffer("");
    setRound({
      phase            : "proposing",
      myOffer          : 0,
      opponentOffer    : 0,
      myResponse       : null,
      opponentResponse : null,
      resultCode       : null,
      timeLeft         : 30,
    });
  };

  /* ─────────────────────────────────────────────────────────
                       RENDER
  ───────────────────────────────────────────────────────── */

  /* ————— RESULT PHASE ————— */
  if (round.phase === "result") {
    const bothAcc = round.resultCode === "both_accepted";
    const { me: myEarn, op: opEarn } = earningsForRound(
      round.myOffer,
      round.opponentOffer,
      round.myResponse === "accepted",
      round.opponentResponse === "accepted"
    );

    return (
      <div className="game-over-page">
        <div className="game-over-container">
          {/* header */}
          <div className="game-over-header">
            <h1 className="game-over-title">
              Round {roundNumber} / {MAX_ROUNDS} Complete
            </h1>
          </div>

          {/* --- result-card (unchanged … retain your existing JSX) --- */}
          {/* … omitted for brevity – keep your original content … */}

          {/* buttons */}
          <div className="action-buttons">
            <button onClick={startNextRound} className="play-again-button">
              {roundNumber >= MAX_ROUNDS ? "Finish Match" : "Next Round"}
            </button>
            <button onClick={() => navigate("/ultimatum")} className="menu-button">
              Main Menu
            </button>
          </div>

          {/* static pay-off grid */}
          <PayoffsTable history={history} />
        </div>
      </div>
    );
  }

  /* ————— ALL OTHER PHASES ————— */
  return (
    <div className="game-page">
      <div className="game-container">
        {/* headline box */}
        <div className="game-header">
          <h1 className="game-title">Ultimatum</h1>
          <p className="game-subtitle">
            Both players make offers to each other. If either rejects, nobody gets anything.
          </p>
        </div>

        {/* central card */}
        <div className="game-board">
          <div className="game-card">
            {/* timer & phase */}
            <div className="game-card-header">
              <div className="timer">
                <Clock className="timer-icon" />
                <span>{round.timeLeft}s</span>
              </div>
              <h2 className="phase-title">
                {round.phase === "proposing"
                  ? "MAKE OFFER"
                  // : round.phase === "waiting"
                  : ["waiting", "waiting_for_player"].includes(round.phase)
                  ? "WAITING…"
                  : "RESPOND"}
              </h2>
            </div>

            {/* content */}
            <div className="game-card-content">
              {/* money pile */}
              <div className="money-display">
                <div className="money-content">
                  <DollarSign className="money-icon" />
                  <span>{TOTAL_MONEY}</span>
                </div>
              </div>

              {/* PROPOSING */}
              {round.phase === "proposing" && (
                <>
                  <p className="offer-label">How much will you offer your opponent?</p>
                  <div className="offer-input-container">
                    <input
                      type="number"
                      value={inputOffer}
                      onChange={e => setInputOffer(e.target.value)}
                      min="0"
                      max={TOTAL_MONEY}
                      placeholder="0"
                      className="offer-input"
                    />
                    <div className="dollar-sign">$</div>
                  </div>
                  <button
                    onClick={submitOffer}
                    disabled={!inputOffer || +inputOffer < 0 || +inputOffer > TOTAL_MONEY}
                    className="submit-button"
                  >
                    SUBMIT OFFER
                  </button>
                </>
              )}

              {/* WAITING */}
              {/* {round.phase === "waiting" && ( */}
              {round.phase === "waiting_for_player" && (
                <div className="waiting-section">
                  <div className="waiting-animation">
                    <div className="waiting-spinner" />
                    <p className="waiting-text">Waiting for opponent…</p>
                  </div>
                  <p className="offer-amount">Your offer: ${round.myOffer}</p>
                </div>
              )}
              
                {round.phase === "waiting" && (
                  <div className="waiting-section">
                    <div className="waiting-animation">
                      <div className="waiting-spinner" />
                      <p className="waiting-text">Waiting for opponent’s decision…</p>
                    </div>
                    <p className="offer-amount">Your offer: ${round.myOffer}</p>
                  </div>
                )}

              {/* RESPONDING */}
              {round.phase === "responding" && (
                <>
                  <div className="responding-section">
                    <div className="offers-comparison">
                      <div className="offer-item">
                        <p className="offer-label-small">Your Offer</p>
                        <p className="offer-amount-large">${round.myOffer}</p>
                      </div>
                      <div className="offer-item">
                        <p className="offer-label-small">Opponent's Offer</p>
                        <p className="offer-amount-large highlight">${round.opponentOffer}</p>
                      </div>
                    </div>

                    <div className="decision-info">
                      <p className="decision-text">
                        Opponent offers you{" "}
                        <span className="highlight-amount">${round.opponentOffer}</span>
                      </p>
                      <p className="keep-amount">If you accept, you’ll earn: ${round.opponentOffer}</p>
                      <p className="keep-amount">If you reject, you’ll earn: $0</p>
                    </div>

                    <div className="response-buttons">
                      <button onClick={() => respond(true)}  className="accept-button">
                        ACCEPT
                      </button>
                      <button onClick={() => respond(false)} className="reject-button">
                        REJECT
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

        </div>

        {/*  fixed pay-off table, always visible  */}
        {/* <PayoffsTable history={history} /> */}
        <div className="payoffs-area">
          <PayoffsTable history={history} />
        </div>
      </div>
    </div>
  );
}
