/* eslint-env browser */
let ws = null;
const WS_URL = "ws://localhost:8080"

export function ensureSocket() {
  // Reuse if it's already open/connecting; only recreate if it was CLOSED
  if (ws && ws.readyState !== WebSocket.CLOSED) return ws;

  ws = new WebSocket(WS_URL);       // native browser WebSocket

  // Simple lifecycle logs so you can see what's happening
  ws.addEventListener("open",  () => console.log("[ws] open"));
  ws.addEventListener("close", () => console.log("[ws] close"));
  ws.addEventListener("error", (e) => console.log("[ws] error", e));
  // ws.addEventListener("message", (e) =>
  //   console.log("[ws] message →", String(e.data))   // server → browser
  // );

  return ws;
}

// Tiny test helper: send "ping" now or once the socket opens
export function sendPing() {
  const s = ensureSocket();
  const packet = JSON.stringify({ type: "ping" }); // minimal envelope

  if (s.readyState === WebSocket.OPEN) {
    s.send(packet);
  }
}

export function sendMessage(fromUserId, toUserId, content) {
  const s = ensureSocket();
  const packet = JSON.stringify({ 
    type: "send_message",
    payload: {
      "fromUserId": fromUserId,
      "toUserId": toUserId,
      "content": content
    }});

  if (s.readyState === WebSocket.OPEN){
    s.send(packet);
  } 
}