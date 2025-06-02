import { useState, useEffect, useRef } from "react";
// import { Loader2, Wifi, WifiOff } from "lucide-react";
import { Loader2, Wifi, WifiOff, XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createMatch } from "./ultimatum";
import { getOrCreateFingerprint } from "./fingerprint";
import { wsUrl }       from ".//wsUrl";
import "./MatchmakingPage.css"
export default function MatchmakingPage() {
  const navigate = useNavigate()
  const [isSearching,       setIsSearching]       = useState(true);
  const [playerId,          setPlayerId]          = useState("");
  const [connectionStatus,  setConnectionStatus]  = useState("connecting");

  /* keep match-id in query so GamePage can grab it */
  const goToGame = (matchId, fp) =>
        navigate(`/ultimatum/game?match=${matchId}&fp=${fp}`);
  const wsRef = useRef(null); 
    const waitOnWebSocket = (matchId, fingerprint) => {
    // const url = `ws://${window.location.host}/ws/ultimatum-game/${matchId}/`;
  //  const proto = window.location.protocol === "https:" ? "wss" : "ws";
    // in dev the front-end is  :8443 but back-end is :8000
    // const backendHost = import.meta.env.DEV ? "localhost:8000" : window.location.host;
    // const url = `${proto}://${backendHost}/ws/ultimatum-game/${matchId}/`;
    const url = wsUrl(matchId);
    console.log("Connecting to WebSocket:", url);
    const ws  = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ action: "join", player_fingerprint: fingerprint }));
      setConnectionStatus("connected");
    };

    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.game_state && !m.game_state.waitingForOpponent) {
        ws.close();
        navigate(`/ultimatum/game?match=${matchId}&fp=${fingerprint}`);
      }
    };

    ws.onclose   = () => setConnectionStatus("disconnected");
    ws.onerror   = () => setConnectionStatus("disconnected");
  };

  useEffect(() => {
      const fp = getOrCreateFingerprint();
    setPlayerId(fp);

    (async () => {
      const res = await createMatch("online", fp);

      // if (res.status === "created_new_match") {
      if (res.status === "created_new_match" || res.status === "rejoin_existing_match") {
        /* I'm player-1 → open WS and wait */
        waitOnWebSocket(res.match_id, fp);
      } else if (res.status === "joined_existing_match") {
        /* I'm player-2 → go straight in */
        navigate(`/ultimatum/game?match=${res.match_id}&fp=${fp}`);
      } else {
        // alert(res.message || "Could not join match.");
          window.dispatchEvent(
          new CustomEvent("GLOBAL_MODAL", {
            detail: {
              title: "Oops!",
              msg  : res.message || "Could not join match.",
            },
          })
        );
        setConnectionStatus("disconnected");
        setIsSearching(false);
      }
    })();

    /* cleanup */
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []); // run once


  const handleCancel = () => {
    if (wsRef.current) wsRef.current.close();
    /* (optional) tell server to delete incomplete match */
    // fetch("/api/ultimatum/cleanup-matches/", { method: "POST" });
    navigate("/ultimatum");     // back to main menu
  };

  return (
    <div className="matchmaking-page">
      <div className="matchmaking-container">
        <div className="matchmaking-header">
          <h1 className="matchmaking-title">Ultimatum</h1>
          <p className="matchmaking-subtitle">
            You and a player are dividing a stack of coins. If the other player rejects your proposal, you both get
            nothing. How much will you offer?
          </p>
        </div>

        <div className="matchmaking-card">
          <div className="matchmaking-icon-container">
            {isSearching ? (
              <Loader2 className="matchmaking-spinner" />
            ) : (
              <div className="matchmaking-success">
                <span>✓</span>
              </div>
            )}
          </div>
          <h2 className="matchmaking-status-title">{isSearching ? "Waiting for Opponent" : "Opponent Found!"}</h2>
          <p className="matchmaking-status-text">
            {isSearching
              ? "Please wait while we find another player to join your game..."
              : "Match found! Starting game..."}
          </p>

          <div className="matchmaking-info">
            <div className="matchmaking-info-row">
              <span>Your ID:</span>
              <span className="matchmaking-player-id">{playerId}</span>
            </div>
            <div className="matchmaking-info-row">
              <span>Connection Status:</span>
              <div className="connection-status">
                {connectionStatus === "connected" ? (
                  <>
                    <Wifi className="connection-icon connection-connected" />
                    <span className="connection-connected">Connected</span>
                  </>
                ) : connectionStatus === "connecting" ? (
                  <>
                    <Loader2 className="connection-icon connection-connecting" />
                    <span className="connection-connecting">Connecting</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="connection-icon connection-disconnected" />
                    <span className="connection-disconnected">Disconnected</span>
                  </>
                )}
              </div>
            </div>
          </div>

         {isSearching && (
          <button onClick={handleCancel} className="cancel-button">
            <XCircle size={16} style={{marginRight:6}}/>
            Cancel Search
          </button>
        )}
        </div>
      </div>
    </div>
  )
}
