/**
 * Build the correct WebSocket URL for any environment.
 * - In development (hostname === "localhost") we talk to Django on :8001
 * - In production we assume the front-end is served by Django, so same host/port.
 */
export function wsUrl(matchId, path = "ultimatum-game") {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host =
    window.location.hostname === "localhost"
      ? "localhost:8001"           // backend dev port
      : window.location.host;      // prod = same host/port
  return `${protocol}//${host}/ws/${path}/${matchId}/`;
}
