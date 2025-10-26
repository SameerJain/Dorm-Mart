// ---------- API helpers ----------
export async function fetchMe(signal) {
  const BASE = process.env.REACT_APP_API_BASE || "/api";
  const r = await fetch(`${BASE}/auth/me.php`, {
    method: "GET",
    credentials: "include",
    headers: { Accept: "application/json" },
    signal,
  });
  if (!r.ok) {
    const err = new Error(`HTTP ${r.status}`);
    err.status = r.status;           // <-- add status so callers can branch on 401
    throw err;
  }
  return r.json();
}

export async function fetchConversation(userId, signal) {
  // returns: { success: true, conversations: [{ conv_id, user_1, user_2, ... }] }
  const BASE = process.env.REACT_APP_API_BASE || "/api";
  const r = await fetch(`${BASE}/chat/read_conversation.php?user_id=${userId}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal,
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export async function fetchChat(convId, signal) {
  // returns: { success: true, messages: [{ message_id, sender_id, content, created_at, ... }] }
  const BASE = process.env.REACT_APP_API_BASE || "/api";
  const r = await fetch(`${BASE}/chat/read_chat.php?conv_id=${convId}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "include", // session-based auth
    signal,
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export async function createMessage({ senderId, receiverId, content, signal }) {
  const BASE = process.env.REACT_APP_API_BASE || "/api";
  const r = await fetch(`${BASE}/chat/create_message.php`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json", // tells PHP we’re sending JSON
      "Accept": "application/json"
    },
    credentials: "include",               // sends PHP session cookie if your server uses it
    body: JSON.stringify({
      sender_id: senderId,                // matches your PHP keys
      receiver_id: receiverId,
      content
    }),
    signal                                // lets you cancel if needed
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();                        // expect JSON back from PHP
}