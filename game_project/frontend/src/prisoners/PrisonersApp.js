
import { useState } from "react";
import { Routes, Route } from "react-router-dom";
// import Header from "../components/Header";
import GameRules from "../components/GameRules";
import GameBoard from "../components/GameBoard";
import "../App.css";

function PrisonersApp() {
  const [matchId, setMatchId] = useState(null);
  const [playerFingerprint, setPlayerFingerprint] = useState(null);

  return (
    <div className="app">
      {/* <Header /> */}
      <div className="container">
        <Routes>
          <Route
            path="/"
            element={
              <GameRules
                setMatchId={setMatchId}
                setPlayerFingerprint={setPlayerFingerprint}
              />
            }
          />
          <Route
            path="/game/:matchId"
            element={<GameBoard playerFingerprint={playerFingerprint} />}
          />
        </Routes>
      </div>
    </div>
  );
}

export default PrisonersApp;
