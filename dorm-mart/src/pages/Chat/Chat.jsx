import { useEffect, useMemo, useRef, useState } from "react";
import {
  fetchMe,
  fetchConversation,
  fetchChat,
  createMessage,
} from "./chat_util";
import { useNavigate } from "react-router-dom";
import { ensureSocket, getSocket } from "../../server/ws-demo";

export default function ChatPage() {
  const wsRef = useRef(null);
  const navigate = useNavigate();
  const MAX_LEN = 500; // hard cap; used by textarea and counter
  const [myId, setMyId] = useState(null);
  const myIdRef = useRef(null);
  useEffect(() => {
    myIdRef.current = myId;
  }, [myId]);
  const [conversations, setConversations] = useState([]); // [{ id, otherUserId }]
  const [activeId, setActiveId] = useState(null);

  const [messagesByConv, setMessagesByConv] = useState({}); // { [convId]: [{id,sender,text,ts}] }
  const currentFetch = useRef(null); // tracks in-flight fetch to cancel
  const scrollRef = useRef(null);

  const [draft, setDraft] = useState("");

  // below other useState hooks
  const [convError, setConvError] = useState(false); // read_conversation failed
  const [chatErrorByConv, setChatErrorByConv] = useState({}); // per-conv read_chat failure map

  function sendWS(type, payload) {
    const s = wsRef.current;
    if (!s) {
      console.warn("[ws] not ready");
      return;
    }

    const msg = JSON.stringify({ type, payload }); // convention: {type, payload}

    if (s.readyState === WebSocket.OPEN) {
      s.send(msg); // goes out immediately
    } else {
      // If the socket is still CONNECTING, wait once for "open" then send.
      const onOpen = () => {
        s.removeEventListener("open", onOpen); // ensure it fires once
        s.send(msg);
      };
      s.addEventListener("open", onOpen);
    }
  }

  useEffect(async () => {
    const s = await getSocket();
    wsRef.current = s;

    const onMsg = (e) => {
      let parsed;
      try {
        parsed = JSON.parse(e.data); // guard against non-JSON frames
      } catch {
        return;
      }
      if (parsed.type !== "new_message") return;

      const { convId, fromUserId, content } = parsed.payload || {};
      if (!convId) return; // need convo bucket to update

      // Match your normalized shape: { id, sender, text, ts }
      const msg = {
        id: undefined, // backend isn't sending an id yet
        sender: fromUserId === myIdRef.current ? "me" : "them",
        text: content ?? "",
        ts: Date.now(), // no server time provided; use client time for now
      };

      // Functional update to avoid race conditions
      setMessagesByConv((prev) => {
        const list = prev[convId] ?? [];
        return { ...prev, [convId]: [...list, msg] }; // append
      });
    };

    s.addEventListener("message", onMsg);

    let onOpen = null; // keep a ref so we can unbind if this component unmounts early

    async function joinPool() {
      const me = await fetchMe();
      const msg = JSON.stringify({
        type: "join_pool",
        payload: { userId: me.user_id },
      });

      if (s.readyState === WebSocket.OPEN) {
        // socket is ready now → send immediately
        s.send(msg);
      } else if (s.readyState === WebSocket.CONNECTING) {
        // not open yet → send once it opens, then remove the listener
        onOpen = () => {
          s.removeEventListener("open", onOpen); // ensure it fires once
          s.send(msg);
        };
        s.addEventListener("open", onOpen);
      } else {
        // CLOSED or CLOSING; optionally log/handle
        console.warn("[ws] cannot send; state:", s.readyState);
      }
    }

    joinPool();

    return () => {
      s.removeEventListener("message", onMsg);
      if (onOpen) s.removeEventListener("open", onOpen); // cleanup if unmounted before open
    };
  }, []);

  // Load me + conversations on mount
  useEffect(() => {
    const controller = new AbortController();

    async function loadConversations() {
      try {
        setConvError(false); // clear previous error before fetching
        const me = await fetchMe(controller.signal);
        setMyId(me.user_id);

        const res = await fetchConversation(me.user_id, controller.signal);
        const view = res.conversations.map((c) => {
          const u1 = c.user1_id;
          const u2 = c.user2_id;
          const iAmUser1 = u1 === me.user_id;
          const otherId = iAmUser1 ? u2 : u1;
          const n1 = c.user1_fname;
          const n2 = c.user2_fname;
          const otherName = iAmUser1 ? n2 : n1;
          return {
            id: c.conv_id,
            otherUserId: otherId,
            otherUserName: otherName,
          };
        });
        setConversations(view);
      } catch (err) {
        if (err.name !== "AbortError") {
          if (err.status === 401 || String(err.message).includes("HTTP 401")) {
            // Not logged in → send to login page (hash router friendly)
            navigate("/login", { replace: true }); // replaces history so back won’t loop
            return;
          }
          console.error(err);
          setConvError(true); // flag sidebar error state
        }
      }
    }

    loadConversations();
    return () => controller.abort();
  }, []);

  // Load messages when a conversation is selected (on click)
  async function selectConversation(convId) {
    setActiveId(convId);

    // clear any previous error for this convo
    setChatErrorByConv((prev) => ({ ...prev, [convId]: false }));

    if (messagesByConv[convId]) return;

    if (currentFetch.current) currentFetch.current.abort();

    const controller = new AbortController();
    currentFetch.current = controller;

    try {
      const res = await fetchChat(convId, controller.signal);
      const raw = res.messages ?? res.data ?? [];
      const normalized = raw.map((m) => ({
        id: m.message_id ?? m.id,
        sender: m.sender_id === myId ? "me" : "them",
        text: m.content ?? m.text ?? "",
        ts:
          m.created_at_ms ??
          (m.created_at_s ? m.created_at_s * 1000 : Date.parse(m.created_at)),
      }));
      setMessagesByConv((prev) => ({ ...prev, [convId]: normalized }));
    } catch (err) {
      if (err.name !== "AbortError") {
        console.error(err);
        // mark this conversation as failed to load messages
        setChatErrorByConv((prev) => ({ ...prev, [convId]: true }));
      }
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
    const convo = conversations.find((x) => x.id === activeId);
    if (!convo) return;
    const receiverId = convo.otherUserId;

    try {
      const res = await createMessage({
        senderId: myId,
        receiverId,
        content: text,
        signal: undefined, // optional: wire an AbortController if you want
      });

      // Use server echo if present; otherwise fall back to what we sent
      const saved = res.message ?? {};
      const newMsg = {
        id: saved.message_id ?? `m${Date.now()}`,
        sender: "me",
        text: saved.content ?? text,
        ts: Date.parse(saved.created_at ?? "") || Date.now(),
      };

      setMessagesByConv((prev) => {
        const list = prev[activeId] ? [...prev[activeId], newMsg] : [newMsg];
        return { ...prev, [activeId]: list };
      });

      sendWS("send_message", {
        convId: convo.id,
        fromUserId: myId,
        toUserId: receiverId,
        content: text,
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
    <div className="h-screen w-full bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <div className="mx-auto h-full max-w-[1200px] px-4 py-6">
        <div className="grid h-full grid-cols-12 gap-4">
          {/* Sidebar */}
          <aside className="col-span-4 rounded-2xl border-4 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
            <div className="border-b border-gray-200 dark:border-gray-700 p-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Chats</h2>
            </div>
            <ul
              role="list"
              className="max-h-[70vh] overflow-y-auto p-2"
              aria-label="Conversation list"
            >
              {convError ? (
                <li>
                  <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                    Something went wrong, please try again later
                  </div>
                </li>
              ) : (
                conversations.map((c) => {
                  const isActive = c.id === activeId;
                  return (
                    <li key={c.id}>
                      <button
                        onClick={() => selectConversation(c.id)}
                        className={
                          "flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition " +
                          (isActive
                            ? "bg-indigo-50 text-indigo-700"
                            : "hover:bg-gray-100")
                        }
                        aria-current={isActive ? "true" : undefined}
                      >
                        <span className="truncate font-medium">
                          {c.otherUserName}
                        </span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </aside>

          {/* Main chat pane */}
          <section className="col-span-8 flex flex-col rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
            {/* Header */}
            <div className="flex items-center justify-between border-4 border-gray-200 dark:border-gray-700 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{activeLabel}</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">Direct message</p>
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
                  <p className="text-sm text-gray-500">
                    Select a chat to view messages.
                  </p>
                </div>
              ) : chatErrorByConv[activeId] ? (
                <p className="text-center text-sm text-red-600 dark:text-red-400">
                  Something went wrong, please try again later
                </p>
              ) : messages.length === 0 ? (
                <p className="text-center text-sm text-gray-500">
                  No messages yet.
                </p>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={
                      m.sender === "me"
                        ? "flex justify-end"
                        : "flex justify-start"
                    }
                  >
                    <div
                      className={
                        "max-w-[80%] rounded-2xl px-4 py-2 text-sm shadow " +
                        (m.sender === "me"
                          ? "bg-indigo-600 text-white"
                          : "bg-gray-100 text-gray-900")
                      }
                    >
                      <p className="whitespace-pre-wrap">{m.text}</p>
                      <div
                        className={
                          "mt-1 text-[10px] " +
                          (m.sender === "me"
                            ? "text-indigo-100"
                            : "text-gray-500")
                        }
                      >
                        {fmtTime(m.ts)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Composer */}
            <div className="border-t border-gray-200 dark:border-gray-700 p-4">
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
                    className="min-h-[44px] w-full resize-y rounded-2xl border border-gray-300 dark:border-gray-600 px-3 py-2 pr-12 pb-6 text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    //               ^^^^ extra right/bottom padding so the counter doesn't overlap text
                    aria-label="Message input"
                  />
                  <span
                    id="message-char-remaining"
                    className="pointer-events-none absolute bottom-2 right-3 text-xs text-gray-500 dark:text-gray-400"
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
              <p className="mt-2 text-xs text-gray-500">
                Press Enter to send • Shift+Enter for a new line
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
