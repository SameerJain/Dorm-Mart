// ---------- API helpers ----------

const BASE =  process.env.REACT_APP_API_BASE || "/api";

export async function fetch_me(signal) {
  const r = await fetch(`${BASE}/auth/me.php`, {
    method: 'GET',
    credentials: 'include', // send cookies (PHP session) with the request
    headers: { 'Accept': 'application/json' },
    signal // allows aborting the request if the component unmounts
  });
  if (!r.ok) throw new Error(`not authenticated`);
  return r.json();
}

export async function fetch_conversations(signal) {
  // returns: { success: true, conversations: [{ conv_id, user_1, user_2, ... }] }
  const r = await fetch(`${BASE}/chat/read_conversations.php`, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal,
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export async function fetch_chat(convId, signal) {
  // returns: { success: true, messages: [{ message_id, sender_id, content, created_at, ... }] }
  const r = await fetch(`${BASE}/chat/read_chat.php?conv_id=${convId}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "include", // session-based auth
    signal,
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export async function fetch_new_messages(convId, ts, signal) {
  const r = await fetch(`${BASE}/chat/read_new_message.php?conv_id=${convId}&ts=${ts}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "include", // session-based auth
    signal,
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export async function create_message({ receiverId, content, signal }) {
  const r = await fetch(`${BASE}/chat/create_message.php`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json", // tells PHP we’re sending JSON
      "Accept": "application/json"
    },
    credentials: "include",               // sends PHP session cookie if your server uses it
    body: JSON.stringify({
      receiver_id: receiverId,
      content
    }),
    signal                                // lets you cancel if needed
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();                        // expect JSON back from PHP
}