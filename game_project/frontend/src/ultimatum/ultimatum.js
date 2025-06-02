/* api/ultimatum.js */
export async function createMatch(gameMode, fingerprint) {
  const res = await fetch("/api/ultimatum/create-match-ultimatum/", {
    method : "POST",
    headers: { "Content-Type": "application/json" },
    body   : JSON.stringify({ game_mode: gameMode, player_fingerprint: fingerprint }),
  });
  return res.json();        // { status, match_id, … }
}
