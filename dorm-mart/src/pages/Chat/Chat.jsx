import React, { useEffect, useMemo, useRef, useState } from "react";

// ---------- API helpers ----------
async function fetchMe(signal) {
  const BASE = process.env.REACT_APP_API_BASE || "/api";
  // returns: { success: true, user_id: <number> }
  const r = await fetch(`${BASE}/auth/me.php`, {
    method: "GET",
    credentials: "include",      // send PHP session cookie
    headers: { Accept: "application/json" },
    signal,                      // allow abort on unmount
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

async function fetchConversation(userId, signal) {
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

async function fetchChat(convId, signal) {
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

async function createMessage({ senderId, receiverId, content, signal }) {
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

// ---------- Page ----------
export default function ChatPage() {
  const [myId, setMyId] = useState(null);
  const [conversations, setConversations] = useState([]); // [{ id, otherUserId }]
  const [activeId, setActiveId] = useState(null);

  const [messagesByConv, setMessagesByConv] = useState({}); // { [convId]: [{id,sender,text,ts}] }
  const currentFetch = useRef(null);                         // tracks in-flight fetch to cancel
  const scrollRef = useRef(null);

  const [draft, setDraft] = useState("");

  // Load me + conversations on mount
  useEffect(() => {
    const controller = new AbortController();

    async function loadConversations() {
      try {
        const me = await fetchMe(controller.signal);
        setMyId(me.user_id);

        const res = await fetchConversation(me.user_id, controller.signal);
        const view = (res.conversations ?? []).map((c) => ({
          id: c.conv_id,
          otherUserId: c.user_1 === me.user_id ? c.user_2 : c.user_1,
        }));
        setConversations(view);

        // Select first conversation by default (if any)
        if (!activeId && view.length > 0) {
          setActiveId(view[0].id);
        }
      } catch (err) {
        if (err.name !== "AbortError") console.error(err);
      }
    }

    loadConversations();
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once

  // Load messages when a conversation is selected (on click)
  async function selectConversation(convId) {
    setActiveId(convId);

    // If cached, don't re-fetch
    if (messagesByConv[convId]) return;

    // Cancel any in-flight fetch to avoid race conditions
    if (currentFetch.current) currentFetch.current.abort();

    const controller = new AbortController();
    currentFetch.current = controller;

    try {
      const res = await fetchChat(convId, controller.signal);
      const raw = res.messages ?? res.data ?? [];
      console.log(raw);

      // Normalize to the UI shape expected by the message renderer
      const normalized = raw.map((m) => ({
        id: m.message_id ?? m.id,
        sender: m.sender_id === myId ? "me" : "them",
        text: m.content ?? m.text ?? "",
        ts: Date.parse(m.created_at),
      }));
      
      setMessagesByConv((prev) => ({ ...prev, [convId]: normalized }));
    } catch (err) {
      if (err.name !== "AbortError") console.error(err);
    }
  }

  // Derived: messages for the active conversation
  const messages = useMemo(
    () => messagesByConv[activeId] || [],
    [messagesByConv, activeId]
  );

  // Auto-scroll to bottom when messages change or active chat switches
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [activeId, messages.length]);

  // Small time formatter
  function fmtTime(ts) {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }


async function sendMessage() {
  const text = draft.trim();
  if (!text || !activeId || !myId) return;

  // figure out the receiver from the selected conversation
  const convo = conversations.find(x => x.id === activeId);
  if (!convo) return;
  const receiverId = convo.otherUserId;

  try {
    const res = await createMessage({
      senderId: myId,
      receiverId,
      content: text,
      signal: undefined // optional: wire an AbortController if you want
    });

    // Use server echo if present; otherwise fall back to what we sent
    const saved = res.message ?? {};
    const newMsg = {
      id: saved.message_id ?? `m${Date.now()}`,
      sender: "me",
      text: saved.content ?? text,
      ts: Date.parse(saved.created_at ?? "") || Date.now()
    };

    setMessagesByConv(prev => {
      const list = prev[activeId] ? [...prev[activeId], newMsg] : [newMsg];
      return { ...prev, [activeId]: list };
    });

    setDraft("");
  } catch (err) {
    console.error(err);
    // optional: surface a toast/error state here
  }
}


  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  // Header label: show the other user id for now
  const activeLabel = useMemo(() => {
    const c = conversations.find((x) => x.id === activeId);
    return c ? `User ${c.otherUserId}` : "Select a chat";
  }, [conversations, activeId]);

  return (
    <div className="h-screen w-full bg-gray-50 text-gray-900">
      <div className="mx-auto h-full max-w-[1200px] px-4 py-6">
        <div className="grid h-full grid-cols-12 gap-4">
          {/* Sidebar */}
          <aside className="col-span-4 rounded-2xl border-4 border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 p-4">
              <h2 className="text-lg font-semibold">Chats</h2>
            </div>

            <ul role="list" className="max-h-[70vh] overflow-y-auto p-2" aria-label="Conversation list">
              {conversations.map((c) => {
                const isActive = c.id === activeId;
                return (
                  <li key={c.id}>
                    <button
                      onClick={() => selectConversation(c.id)}
                      className={
                        "flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition " +
                        (isActive ? "bg-indigo-50 text-indigo-700" : "hover:bg-gray-100")
                      }
                      aria-current={isActive ? "true" : undefined}
                    >
                      <span className="truncate font-medium">User {c.otherUserId}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>

          {/* Main chat pane */}
          <section className="col-span-8 flex flex-col rounded-2xl border border-gray-200 bg-white shadow-sm">
            {/* Header */}
            <div className="flex items-center justify-between border-4 border-gray-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold">{activeLabel}</h2>
                <p className="text-xs text-gray-500">Direct message</p>
              </div>
            </div>

            {/* Messages */}
            <div
              ref={scrollRef}
              className="flex-1 space-y-2 overflow-y-auto px-4 py-4"
              role="log"
              aria-live="polite"
              aria-relevant="additions"
            >
              {messages.length === 0 ? (
                <p className="text-center text-sm text-gray-500">No messages yet.</p>
              ) : (
                messages.map((m) => (
                  <div key={m.id} className={m.sender === "me" ? "flex justify-end" : "flex justify-start"}>
                    <div
                      className={
                        "max-w-[80%] rounded-2xl px-4 py-2 text-sm shadow " +
                        (m.sender === "me" ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-900")
                      }
                    >
                      <p className="whitespace-pre-wrap">{m.text}</p>
                      <div className={"mt-1 text-[10px] " + (m.sender === "me" ? "text-indigo-100" : "text-gray-500")}>
                        {fmtTime(m.ts)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Composer */}
            <div className="border-t border-gray-200 p-4">
              <div className="flex items-end gap-2">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message…"
                  rows={2}
                  className="min-h-[44px] w-full resize-y rounded-2xl border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  aria-label="Message input"
                />
                <button
                  onClick={sendMessage}
                  className="h-[44px] shrink-0 rounded-2xl bg-indigo-600 px-4 text-sm font-semibold text-white shadow hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  aria-label="Send message"
                >
                  Send
                </button>
              </div>
              <p className="mt-2 text-xs text-gray-500">Press Enter to send • Shift+Enter for a new line</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
