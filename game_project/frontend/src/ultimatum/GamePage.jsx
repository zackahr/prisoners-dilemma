//  src/components/GamePage.jsx
"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Clock,
  DollarSign,
  CheckCircle,
  XCircle,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";

import PayoffsTable from "./PayoffsTable";    //  ← NEW
import "./GamePage.css";

const MAX_ROUNDS  = 25;
const TOTAL_MONEY = 100;

export default function GamePage() {
  const navigate       = useNavigate();
  const [searchParams] = useSearchParams();
  const gameMode       = searchParams.get("mode") || "online";

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

  /* ─────────────────────────────────────────────────────────
     TIMER
  ───────────────────────────────────────────────────────── */
  useEffect(() => {
    if (round.timeLeft <= 0) return;

    if (["proposing", "responding"].includes(round.phase)) {
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

  /* ─────────────────────────────────────────────────────────
     SUBMIT OFFER
  ───────────────────────────────────────────────────────── */
  const submitOffer = useCallback(() => {
    const offer = Math.max(0, Math.min(+inputOffer || 0, TOTAL_MONEY));

    /* move to WAITING phase */
    setRound({
      ...round,
      phase     : "waiting",
      myOffer   : offer,
      timeLeft  : 15,
    });

    /* simulate opponent offer after 3 s */
    setTimeout(() => {
      const opponentOffer =
        gameMode === "bot"
          ? Math.floor(Math.random() * 20) + 25
          : Math.floor(Math.random() * 30) + 20;

      setRound(r => ({
        ...r,
        phase         : "responding",
        opponentOffer : opponentOffer,
        timeLeft      : 30,
      }));
    }, 3000);
  }, [inputOffer, gameMode]);

  /* ─────────────────────────────────────────────────────────
     PLAYER RESPONSE
  ───────────────────────────────────────────────────────── */
  const respond = accepted => {
    setRound(r => ({ ...r, myResponse: accepted ? "accepted" : "rejected", timeLeft: 15 }));

    /* simulate opponent response after 2 s */
    setTimeout(() => {
      const oppAccept =
        gameMode === "bot"
          ? round.myOffer >= TOTAL_MONEY * 0.3
          : Math.random() < round.myOffer / TOTAL_MONEY + 0.2;

      const bothAcc = accepted && oppAccept;
      const result  = bothAcc
        ? "both_accepted"
        : accepted
        ? "opponent_rejected"
        : oppAccept
        ? "i_rejected"
        : "both_rejected";

      /* compute points and store in match history */
      // const { me: p1, op: p2 } = earningsForRound(
      //   round.myOffer,
      //   round.opponentOffer,
      //   accepted,
      //   oppAccept
      // );

      // setHistory(h => [
      //   // ...h,
      //   // { roundNumber, player1Points: p1, player2Points: p2 },
      //    ...h,
      //   { roundNumber,
      //     player1Offer : round.myOffer,
      //     player2Offer : round.opponentOffer }
      // ]);
      setHistory(h => [
        ...h,
        {
          roundNumber,
          player1Offer: round.myOffer,
          player2Offer: round.opponentOffer,
        },
      ]);

      setRound(r => ({
        ...r,
        opponentResponse : oppAccept ? "accepted" : "rejected",
        phase            : "result",
        resultCode       : result,
      }));
    }, 2000);
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
                  : round.phase === "waiting"
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
              {round.phase === "waiting" && (
                <div className="waiting-section">
                  <div className="waiting-animation">
                    <div className="waiting-spinner" />
                    <p className="waiting-text">Waiting for opponent…</p>
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
