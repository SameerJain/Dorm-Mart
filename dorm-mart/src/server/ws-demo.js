/* eslint-env browser */
let ws = null;
const scheme = window.location.protocol === "https:" ? "wss" : "ws";
const WS_URL = `${scheme}://${process.env.REACT_APP_WS_ADDRESS}:${process.env.REACT_APP_WS_PORT}`
console.log(WS_URL);
export async function ensureSocket() {
  // reuse if it's already open/connecting
  // only recreate if it was CLOSED
  if (ws && ws.readyState !== WebSocket.CLOSED) return ws;
  
  // if ws is used, then, the handshake request won't include credentials
  // therefore, fetch ws_token to identify the user
  if (scheme === "ws") {
      const BASE = process.env.REACT_APP_API_BASE || "/api";
      const r = await fetch(`${BASE}/auth/ws_token.php`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });
      if (!r.ok) throw new Error("Not authenticated");
      const { token } = await r.json();
      ws = new WebSocket(`${WS_URL}?token=${encodeURIComponent(token)}`)
  } else{
    ws = new WebSocket(WS_URL);       // native browser WebSocket
  }
  

  // you can add as many functions as needed to each tag to use them
  // ensure to remove them as you add
  ws.addEventListener("open",  () => console.log("[ws] open"));
  ws.addEventListener("close", () => console.log("[ws] close"));

  // leave error for now
  ws.addEventListener("error", () => console.log("[ws] error"));

  const welcomeHandler = (e) => {
    let parsed = JSON.parse(e.data);
    if (parsed.type === 'hello') {
        console.log(parsed.payload?.msg);
    }
  }

  // since welcomeHandler used only once, remove once it is called
  ws.addEventListener("message", welcomeHandler, {once: true});

  return ws;
}

export function getSocket() {
  return ws;
}

export function closeSocket(code = 1000, reason = "logout") {
  if (ws) { 
    ws.close(code, reason)
    ws = null;
  }
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