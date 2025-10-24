import React, { useEffect, useMemo, useRef, useState } from "react";
import { fetchMe, fetchConversation, fetchChat, createMessage } from "./chat_util";

export default function ChatPage() {
  const MAX_LEN = 500; // hard cap; used by textarea and counter
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
        const view = (res.conversations ?? []).map((c) => {
        // Handle both old (user_1/user_2) and new (user1_id/user2_id) schemas.
        const u1 = c.user1_id ?? c.user_1;      // supports both key styles
        const u2 = c.user2_id ?? c.user_2;

        // Pick the "other" participant relative to me
        const iAmUser1 = u1 === me.user_id;
        const otherId  = iAmUser1 ? u2 : u1;

        // Full names from new schema (fallbacks keep you safe during migration)
        const n1 = c.user1_fname ?? c.user1_name ?? null; // e.g., "First Last"
        const n2 = c.user2_fname ?? c.user2_name ?? null;
        const otherName = iAmUser1 ? (n2 || `User ${otherId}`) : (n1 || `User ${otherId}`);

        return {
            id: c.conv_id,
            otherUserId: otherId,
            otherUserName: otherName,
          };
        });
        setConversations(view);

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
        ts: m.created_at_ms ?? (m.created_at_s ? m.created_at_s * 1000 : Date.parse(m.created_at)),
        // ^ prefer ms from server; fallback to parsing only if missing
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
    return c ? c.otherUserName : "Select a chat";
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
                      <span className="truncate font-medium">{c.otherUserName}</span>
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
              {!activeId ? (
                <div className="flex h-full items-center justify-center">
                  <p className="text-sm text-gray-500">Select a chat to view messages.</p>
                </div>
              ) : messages.length === 0 ? (
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
                <div className="relative w-full">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message…"
                    rows={2}
                    maxLength={MAX_LEN} // prevents typing past 500 on the client
                    aria-describedby="message-char-remaining" // links to the counter for a11y
                    className="min-h-[44px] w-full resize-y rounded-2xl border border-gray-300 px-3 py-2 pr-12 pb-6 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                    //               ^^^^ extra right/bottom padding so the counter doesn't overlap text
                    aria-label="Message input"
                  />
                  <span
                    id="message-char-remaining"
                    className="pointer-events-none absolute bottom-2 right-3 text-xs text-gray-500"
                  >
                    {MAX_LEN - draft.length}
                  </span>
                  {/* ^ absolute positions the live countdown inside the textarea corner */}
                </div>

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
