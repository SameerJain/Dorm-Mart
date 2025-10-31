import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "../../context/ChatContext";

export default function ChatPage() {

  const {
      conversations,
      activeId,
      messages,
      convError,
      chatByConvError,
      sendMsgError,
      // actions
      selectConversation,
      sendMessage,
  } = useChat();

  const MAX_LEN = 500; // hard cap; used by textarea and counter

  const scrollRef = useRef(null);

  const [draft, setDraft] = useState("");

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

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(draft);
      setDraft("");
    }
  }

  // Header label: show the other user id for now
  const activeLabel = useMemo(() => {
    const c = conversations.find((x) => x.id === activeId);
    return c ? c.receiverName : "Select a chat";
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
                          {c.receiverName}
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
              ) : chatByConvError[activeId] ? (
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
                      <p className="whitespace-pre-wrap">{m.content}</p>
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
                  onClick={() => {
                    sendMessage(draft);
                    setDraft("");
                  }}
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
