import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";

export default function ResultsPage() {
  const { matchId }   = useParams();
  const navigate       = useNavigate();
  const [results, setResults] = useState(null);

  // one fetch – lightweight, no auth
  useEffect(() => {
    (async () => {
      const res  = await fetch(`/api/match/${matchId}/`);
      const data = await res.json();
      if (data.status === "success") setResults(data);
      else                           navigate("/");          // bad id ⇒ home
    })();
  }, [matchId, navigate]);

  if (!results) return <p style={{textAlign:"center"}}>Loading…</p>;

  const {
    player_1_score,
    player_2_score,
    player_1_cooperation,
    player_2_cooperation,
  } = results;

  return (
    <div className="game-over" style={{maxWidth:480,margin:"2rem auto"}}>
      <h2>Game Over</h2>
      <p>Your final score&nbsp;: <strong>{player_1_score}</strong></p>
      <p>Opponent score&nbsp;: <strong>{player_2_score}</strong></p>
      <p>Your cooperation&nbsp;: {player_1_cooperation}%</p>
      <p>Opponent cooperation&nbsp;: {player_2_cooperation}%</p>

      <Link to="/" className="start-button" style={{marginTop:"1.5rem"}}>
        Play again
      </Link>
    </div>
  );
}
