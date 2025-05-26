import { useState, useEffect, useRef } from "react"
import { useParams, useNavigate } from "react-router-dom"
import PayoffMatrix from "./PayoffMatrix"
import RoundHistory from "./RoundHistory"
import GameTimer from "./GameTimer"
import "./GameBoard.css"
import Modal from "./Modal";

function GameBoard({ playerFingerprint }) {
  const { matchId } = useParams()
  const navigate = useNavigate()
  const [connected, setConnected] = useState(false)
  const [gameState, setGameState] = useState({
    currentRound: 1,
    maxRounds: 25,
    player1Score: 0,
    player2Score: 0,
    player1CooperationPercent: 0,
    player2CooperationPercent: 0,
    roundHistory: [],
    waitingForOpponent: true,
    gameOver: false,
    player1LastAction: null,
    player2LastAction: null,
    gameMode: "online",
  })
  const [timeLeft, setTimeLeft] = useState(10)
  const [canMakeChoice, setCanMakeChoice] = useState(true)
  const [isPlayer1, setIsPlayer1] = useState(true)
  const [waitingForMyAction, setWaitingForMyAction] = useState(false)
  const [myFingerprint, setMyFingerprint] = useState("")
  const socketRef = useRef(null)
  const [modal, setModal] = useState({open:false, title:"", msg:""});

  // Connect to WebSocket
  useEffect(() => {
    if (!matchId) {
      navigate("/")
      return
    }
    const fingerprint = playerFingerprint || localStorage.getItem("playerUUID")
    if (!fingerprint) {
      navigate("/")
      return
    }

    setMyFingerprint(fingerprint)
    console.log("Connecting with fingerprint:", fingerprint)

    // Create WebSocket connection
    // Use secure WebSocket if the page is served over HTTPS
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
    const host = window.location.host
    const socket = new WebSocket(`${protocol}//${host}/ws/game/${matchId}/`)
    socketRef.current = socket

    socket.onopen = () => {
      console.log("WebSocket connected")
      setConnected(true)
      // Send a join message to the server
      socket.send(
        JSON.stringify({
          action: "join",
          player_fingerprint: fingerprint,
        }),
      )
    }

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data)
      console.log("WebSocket message received:", data)

      // Handle game state updates
      if (data.game_state) {
        console.log("Game state update:", data.game_state)
        updateGameState(data.game_state, fingerprint)
      }
      if (data.game_aborted) {
        // alert(data.message);
        // navigate("/");          // back to landing page
        // return;                 // ignore the rest of this message
        setModal({
            open: true,
            title: "Match aborted",
            msg: data.message         // comes from the server
          });
          return;                     // keep socket open until user clicks OK
      }
      // Handle individual player actions
      if (data.player_fingerprint && data.action) {
        console.log(`Player ${data.player_fingerprint} performed action: ${data.action}`)
        handlePlayerAction(data.player_fingerprint, data.action, fingerprint)
      }

      // Handle game over
      if (data.game_over) {
        console.log("Game over received:", data)
        setGameState((prevState) => ({
          ...prevState,
          gameOver: true,
          player1Score: data.player1_score,
          player2Score: data.player2_score,
          player1CooperationPercent: data.player1_cooperation,
          player2CooperationPercent: data.player2_cooperation,
        }))
      }

      // Handle errors
      if (data.error) {
        console.error("Error from server:", data.error)
        alert(data.error)
        return;
      }
    }

    socket.onclose = () => {
      console.log("WebSocket disconnected")
      setConnected(false)
      
    }

    socket.onerror = (error) => {
      console.error("WebSocket error:", error)
    }

    return () => {
      if (socket) {
        socket.close()
      }
    }
  }, [matchId, navigate, playerFingerprint])

  // Update game state from server
  const updateGameState = (newState, fingerprint) => {
    console.log("Updating game state with fingerprint:", fingerprint)
    console.log("New state:", newState)

    // setGameState((prevState) => ({
    //   ...prevState,
    //   ...newState,
    // }))
    setGameState(prev => {
        const merged = { ...prev, ...newState };
        const iAmP1  = merged.player1Fingerprint === fingerprint;
    
        setIsPlayer1(iAmP1);
        checkIfWaitingForMyAction(merged, iAmP1);
        if (
          merged.currentRound !== prev.currentRound &&   // ✅ changed
          !merged.waitingForOpponent &&
          !merged.gameOver
        ) {
          setTimeLeft(10);
          setCanMakeChoice(true);
        }
        return merged;
      });
    //  const iAmP1 = newState.player1Fingerprint === fingerprint;
    //  setIsPlayer1(iAmP1);
    
    //  // derive role locally ➜ no race with React state
    //  checkIfWaitingForMyAction(newState, iAmP1);
    // Reset timer if we're starting a new round
    if (!newState.waitingForOpponent && !newState.gameOver) {
      setTimeLeft(10)
      setCanMakeChoice(true)
    }
  }
  // const checkIfWaitingForMyAction = (state, iAmP1) => {
  //   if (state.waitingForOpponent || state.gameOver) {
  //     setWaitingForMyAction(false);
  //     return;
  //   }
  
    // const round = state.roundHistory.find(r => r.roundNumber === state.currentRound);
  
    // if (isPlayer1) {
    //   if (iAmP1) {
    //   // player 1 moves first each round
    //   setWaitingForMyAction(!round || !round.player1Action);
    // } else {
    //   // player 2 waits until P1 has chosen, then moves
    //   setWaitingForMyAction(
    //     round && round.player1Action && !round.player2Action
    //   );
    // }
  // };

const checkIfWaitingForMyAction = (state, iAmP1) => {
    if (state.waitingForOpponent || state.gameOver) {
      setWaitingForMyAction(false);
      return;
    }
    const thisRound = state.roundHistory.find(
      r => r.roundNumber === state.currentRound
    );
  
    if (!thisRound) {
      // nobody has acted yet
      setWaitingForMyAction(true);
    } else if (iAmP1) {
      setWaitingForMyAction(thisRound.player1Action == null);
    } else {
      setWaitingForMyAction(thisRound.player2Action == null);
    }
    /* lastAction fields are sent by the server even for an *unfinished*
       round, therefore they are reliable for “have I already clicked?” */
    // const myLast  = iAmP1 ? state.player1LastAction : state.player2LastAction;
    // setWaitingForMyAction(myLast === null);
         // fall back to “not found” when we are in round 1 and nobody has acted
     const myLast = iAmP1 ? state.player1LastAction : state.player2LastAction;
     setWaitingForMyAction(myLast == null);        // catches undefined **or** null
  };
  // Handle player actions
  const handlePlayerAction = (actionPlayerFingerprint, action, myFingerprint) => {
    console.log(`Action from ${actionPlayerFingerprint}, my fingerprint: ${myFingerprint}`)

    // If this is my action, update UI accordingly
    if (actionPlayerFingerprint === myFingerprint) {
      setWaitingForMyAction(false)
      setCanMakeChoice(false)
      console.log("My action processed")
    }

    // If this is the opponent's action, update UI accordingly
    // if (actionPlayerFingerprint !== myFingerprint) {
    //   console.log("Opponent's action processed")
    //     // opponent (P1) just moved → my turn now
    //     setWaitingForMyAction(true);
    //     setCanMakeChoice(true);
    //   // The game state update will handle resetting for the next round
    // }
  }

  // Make a choice (Cooperate or Defect)
  const makeChoice = (action) => {
    if (!canMakeChoice || !connected || gameState.waitingForOpponent || !waitingForMyAction) {
      console.log("Cannot make choice:", {
        canMakeChoice,
        connected,
        waitingForOpponent: gameState.waitingForOpponent,
        waitingForMyAction,
      })
      return
    }

    console.log(`Making choice: ${action}`)
    setCanMakeChoice(false)
    setWaitingForMyAction(false)

    // Send action to server
    if (socketRef.current) {
      socketRef.current.send(
        JSON.stringify({
          action,
          player_fingerprint: myFingerprint,
        }),
      )
    }
  }

  // Share match ID
  const shareMatchId = () => {
    navigator.clipboard
      .writeText(matchId)
      .then(() => {
        alert("Match ID copied to clipboard!")
      })
      .catch((err) => {
        console.error("Failed to copy match ID:", err)
      })
  }

  return (
    <div className="game-container">
      {!connected ? (
        <div className="connecting-screen">
          <div className="connecting-message">Connecting to game server...</div>
        </div>
      ) : gameState.waitingForOpponent ? (
        <div className="waiting-screen">
          <div className="waiting-message">
            <h2>Waiting for another player to join...</h2>
          </div>
          <PayoffMatrix />
        </div>
      ) : gameState.gameOver ? (
        <div className="game-over-screen">
          <h2>Game Over</h2>
          <div className="final-scores">
            <div className="score-box">
              <h3>Your Score</h3>
              <p>{isPlayer1 ? gameState.player1Score : gameState.player2Score}</p>
              <p className="cooperation-rate">
                Cooperation: {isPlayer1 ? gameState.player1CooperationPercent : gameState.player2CooperationPercent}%
              </p>
            </div>
            <div className="score-box">
              <h3>Opponent's Score</h3>
              <p>{isPlayer1 ? gameState.player2Score : gameState.player1Score}</p>
              <p className="cooperation-rate">
                Cooperation: {isPlayer1 ? gameState.player2CooperationPercent : gameState.player1CooperationPercent}%
              </p>
            </div>
          </div>
          <button className="play-again-button" onClick={() => navigate("/")}>
            Play Again
          </button>
          <RoundHistory history={gameState.roundHistory} isPlayer1={isPlayer1} />
        </div>
      ) : (
        <div className="game-screen">
          <div className="game-header">
            <h2>Game is ready to start!</h2>
            <p>Cooperate or Defect</p>
            <p className="player-info">
              You are Player {isPlayer1 ? "1" : "2"} | Round {gameState.currentRound} of {gameState.maxRounds}
            </p>
            {waitingForMyAction ? (
              <p className="action-status">Your turn to choose!</p>
            ) : (
              <p className="action-status">Waiting for opponent...</p>
            )}
          </div>

          <div className="game-timer-container">
            <GameTimer
              timeLeft={timeLeft}
              setTimeLeft={setTimeLeft}
              canMakeChoice={canMakeChoice && waitingForMyAction}
              onTimeUp={() => waitingForMyAction && makeChoice("Defect")}
            />
          </div>

          <div className="scores-container">
            <div className="score-box">
              <h3>Player 1:</h3>
              <p>{gameState.player1Score}</p>
            </div>
            <div className="score-box">
              <h3>Player 2:</h3>
              <p>{gameState.player2Score}</p>
            </div>
          </div>

          <div className="action-buttons">
            <button
              className={`cooperate-button ${!canMakeChoice || !waitingForMyAction ? "disabled" : ""}`}
              onClick={() => makeChoice("Cooperate")}
              disabled={!canMakeChoice || !waitingForMyAction}
            >
              Cooperate
            </button>
            <button
              className={`defect-button ${!canMakeChoice || !waitingForMyAction ? "disabled" : ""}`}
              onClick={() => makeChoice("Defect")}
              disabled={!canMakeChoice || !waitingForMyAction}
            >
              Defect
            </button>
          </div>

          <div className="score-reminder">
            <h3>Score Reminder</h3>
          </div>

          <PayoffMatrix />

          <div className="payoffs-table">
            <h3>Payoffs Table</h3>
            <div className="round-history-table">
              <table>
                <thead>
                  <tr>
                    <th>Player</th>
                    {Array.from({ length: 25 }, (_, i) => (
                      <th key={i + 1}>{i + 1}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Player 1</td>
                    {Array.from({ length: 25 }, (_, i) => {
                      const round = gameState.roundHistory.find((r) => r.roundNumber === i + 1)
                      return (
                        <td
                          key={i + 1}
                          className={
                            round
                              ? round.player1Points === 30
                                ? "high-score"
                                : round.player1Points === 0
                                  ? "zero-score"
                                  : ""
                              : ""
                          }
                        >
                          {round ? round.player1Points : 0}
                        </td>
                      )
                    })}
                  </tr>
                  <tr>
                    <td>Player 2</td>
                    {Array.from({ length: 25 }, (_, i) => {
                      const round = gameState.roundHistory.find((r) => r.roundNumber === i + 1)
                      return (
                        <td
                          key={i + 1}
                          className={
                            round
                              ? round.player2Points === 30
                                ? "high-score"
                                : round.player2Points === 0
                                  ? "zero-score"
                                  : ""
                              : ""
                          }
                        >
                          {round ? round.player2Points : 0}
                        </td>
                      )
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      <Modal
        open={modal.open}
        title={modal.title}
        message={modal.msg}
        onClose={() => {
          setModal({open:false});   // hide dialog
          navigate("/");            // back to landing page
        }}
      />
    </div>
  )
}

export default GameBoard
