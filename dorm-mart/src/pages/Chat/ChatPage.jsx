
import { useEffect, useRef, useState } from 'react';
import ChatSocket from '../web-socket';

const API_BASE = process.env.REACT_APP_API_BASE || '/api';

// For demo purposes, hardcode two users.
// In your real app, read ME from your auth/session state, and choose PEER from UI.
const ME   = '101';
const PEER = '202';

export default function ChatPage() {
  const [ready, setReady] = useState(false); // disable input until socket init done
  const [log, setLog] = useState([]);        // [{from,to,text,ts}, ...]
  const [text, setText] = useState('');
  const sockRef = useRef(null);              // holds ChatSocket instance

  // On first mount: 1) load history, 2) connect WebSocket.
  useEffect(() => {
    let closed = false;

    // 1) Load past messages (REST) so you see history on first render.
    (async () => {
      const r = await fetch(
        `${API_BASE}/read_message.php?user_id=${encodeURIComponent(ME)}&peer_id=${encodeURIComponent(PEER)}`,
        { headers: { 'Accept': 'application/json' } }
      );
      const data = await r.json();
      if (!closed && data?.messages) setLog(data.messages);
    })();

    // 2) Start WebSocket for real-time messages (no SSL in this demo).
    // If you deploy behind HTTPS, you'll typically use wss:// and proxy to :8081.
    sockRef.current = new ChatSocket({
      wsUrl: `ws://${window.location.hostname}:8081`,
      userId: ME,
      onMessage: (evt) => {
        if (evt.op === 'message') {
          // New message from someone (likely PEER) → append to chat log.
          setLog((old) => [...old, { from: evt.from, to: evt.to, text: evt.text, ts: evt.ts }]);
        }
      }
    });

    setReady(true);

    // Cleanup when component unmounts (close socket; stop state updates).
    return () => {
      closed = true;
      sockRef.current?.close();
    };
  }, []);

  // Send handler: persists to DB (REST) + emits on socket (WS) + optimistic UI.
  async function handleSend(e) {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;

    // 1) Persist the message to the database via your simple PHP endpoint.
    await fetch(`${API_BASE}/create_message.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ sender_id: ME, receiver_id: PEER, text: value })
    });

    // 2) Emit real-time signal so PEER sees it instantly if online.
    sockRef.current?.sendText({ to: PEER, text: value });

    // 3) Update our own UI immediately (optimistic render).
    setLog((old) => [...old, { from: ME, to: PEER, text: value, ts: Math.floor(Date.now()/1000) }]);
    setText('');
  }

  return (
    <div style={{ maxWidth: 560, margin: '2rem auto', fontFamily: 'sans-serif' }}>
      <h2>1:1 Chat Demo</h2>

      <div style={{ border: '1px solid #ddd', padding: 12, height: 360, overflowY: 'auto' }}>
        {log.map((m, i) => (
          <div key={i} style={{ margin: '6px 0', textAlign: m.from === ME ? 'right' : 'left' }}>
            <div style={{
              display: 'inline-block',
              padding: '6px 10px',
              borderRadius: 8,
              background: m.from === ME ? '#e6f2ff' : '#f2f2f2'
            }}>
              <div style={{ fontSize: 12, opacity: 0.6 }}>{m.from === ME ? 'You' : `User ${m.from}`}</div>
              <div>{m.text}</div>
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={handleSend} style={{ marginTop: 12, display: 'flex', gap: 8 }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={ready ? 'Type a message…' : 'Connecting…'}
          disabled={!ready}
          style={{ flex: 1, padding: 8, border: '1px solid #ccc', borderRadius: 6 }}
        />
        <button type="submit" disabled={!ready || !text.trim()} style={{ padding: '8px 12px' }}>
          Send
        </button>
      </form>
    </div>
  );
}
