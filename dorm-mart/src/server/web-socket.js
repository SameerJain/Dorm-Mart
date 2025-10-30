// /src/web-socket.js
//
// PURPOSE
// - Wraps the browser WebSocket with minimal reconnection logic.
// - Provides a typed sendText({ to, text }) helper for chat messages.
// - Dispatches every inbound JSON frame to your onMessage callback.
//
// UNFAMILIAR NOTES
// - new WebSocket(url) immediately starts connecting.
// - ws.addEventListener('open'|'message'|'close'|'error', handler)
// - readyState: CONNECTING=0, OPEN=1, CLOSING=2, CLOSED=3
// - setTimeout(fn, ms) schedules a future reconnection attempt.

export default class ChatSocket {
  constructor({ wsUrl, userId, onMessage }) {
    // Attach userId so the backend can identify us on open.
    this.wsUrl = `${wsUrl}?user_id=${encodeURIComponent(userId)}`;
    this.onMessage = onMessage;
    this.ws = null;

    // Simple exponential backoff for reconnects.
    this._retries = 0;
    this._maxRetries = 5;

    this._connect();
  }

  _connect() {
    // connects to WS server
    this.ws = new WebSocket(this.wsUrl);


    this.ws.addEventListener('open', () => {
      // Connection succeeded → reset retry counter.
      this._retries = 0;
    });

    this.ws.addEventListener('message', (e) => {
      // Frames are strings → we expect JSON per our protocol.
      try {
        const data = JSON.parse(e.data);

        
        this.onMessage?.(data);
      } catch {
        // Ignore malformed frames instead of crashing the app.
      }
    });

    this.ws.addEventListener('close', () => {
      // If the server goes away or network blips, try to reconnect a few times.
      if (this._retries < this._maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, this._retries), 8000); // 1s,2s,4s,8s...
        this._retries++;
        setTimeout(() => this._connect(), delay);
      }
    });

    this.ws.addEventListener('error', () => {
      // Closing here will trigger 'close' and unify the reconnect path.
      try { this.ws.close(); } catch {}
    });
  }

  // Send a chat message to a specific peer (matches the server's 'message' op).
  sendText({ to, text }) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ op: 'message', to, text }));
    }
  }

  // Gracefully close the socket when unmounting/navigating away.
  close() {
    try { this.ws?.close(); } catch {}
  }
}
