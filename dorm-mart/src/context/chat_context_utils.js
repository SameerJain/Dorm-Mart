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
  const r = await fetch(`${BASE}/chat/fetch_conversations.php`, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal,
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export async function fetch_conversation(convId, signal) {
  // returns: { success: true, messages: [{ message_id, sender_id, content, created_at, ... }] }
  const r = await fetch(`${BASE}/chat/fetch_conversation.php?conv_id=${convId}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "include", // session-based auth
    signal,
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export async function fetch_new_messages(activeConvId, ts, signal) {
  const r = await fetch(`${BASE}/chat/fetch_new_messages.php?conv_id=${activeConvId}&ts=${ts}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "include", // session-based auth
    signal,
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export async function tick_fetch_new_messages(activeConvId, myId, sinceSec, signal) {
  const res = await fetch_new_messages(activeConvId, sinceSec, signal);
  const raw = res.messages
  if (!raw.length) return [];

  const incoming = raw.map((m) => {
      return {
          message_id: m.message_id,
          sender: m.sender_id === myId ? "me" : "them",
          content: m.content,
          ts: Date.parse(m.created_at),
      }
  });

  return incoming
}

export async function fetch_unread_msg_count(signal) {
  const r = await fetch(`${BASE}/chat/fetch_unread_msg_count.php`, {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "include", // session-based auth
    signal,
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

// export async function tick_fetch_unread_msg_count(singal) {
//   const res = await fetch_unread_msg_count(signal);
//   const raw = res.unreads
//   if (!raw.length) return [];

//   const unreads = raw.map((m) => {
//     return {

//     }
//   })
// }



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