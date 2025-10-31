import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { fetch_me, fetch_conversations, fetch_chat, create_message, fetch_new_messages } from "./chat_utils";

const ChatContext = createContext(null);

export function ChatProvider({ children }) {
    const POLL_MS = 1000;
    const CONV_REFRESH_MS = 15000;

    const [myId, setMyId] = useState(null);
    const myIdRef = useRef(null);
    useEffect(() => { myIdRef.current = myId; }, [myId]);

    const [conversations, setConversations] = useState([]);
    const [activeId, setActiveId] = useState(null);
    const [messagesByConv, setMessagesByConv] = useState({});
    const [convError, setConvError] = useState(false);
    const [chatByConvError, setChatByConvError] = useState({});
    const [sendMsgError, setSendMsgError] = useState({});

    const pollTimerRef = useRef(null);
    const lastTsRefByConv = useRef({}); // { [convId]: last-message-ts }

    useEffect(() => {
        const controller = new AbortController();

        (async () => {
            try {
                setConvError(false);
                const me = await fetch_me(controller.signal);
                setMyId(me.user_id);
                const res = await fetch_conversations(controller.signal);
                if (!res.success) {
                    throw new Error("Failed to load conversations");
                }
                const view = (res.conversations || []).map((c) => {
                    const iAmUser1 = c.user1_id === me.user_id;
                    return {
                        id: c.conv_id,
                        receiverId: iAmUser1 ? c.user2_id : c.user1_id,
                        receiverName: iAmUser1 ? c.user2_fname : c.user1_fname,
                    };
                });
                setConversations(view);
            } catch (err) {
                setConvError(true);
            }
        })();

        return () => controller.abort();
    }, []);

    async function selectConversation(convId) {
        setActiveId(convId);
        setChatByConvError((m) => ({...m, [convId]: false}));

        const controler = new AbortController();
        try {
            const res = await fetch_chat(convId, controler.signal)
            if (!res.success) {
                throw new Error("Failed to load conversations");
            }

            const raw = res.messages || [];
            const normalized = raw.map((m) => {
                return {
                    id: m.message_id,
                    sender: m.sender_id === myIdRef.current ? "me" : "them",
                    content: m.content,
                    ts: Date.parse(m.created_at),
                }
            });

            setMessagesByConv((prev) => ({...prev, [convId]: normalized}));            
            lastTsRefByConv.current[convId] = normalized.length
            ? Math.max(...normalized.map((m) => Number(m.ts) || 0))
            : 0;

            console.log(...normalized.map((m) => Number(m.ts)));

        } catch(err) {
            if (err.name !== "AbortError") {
                setChatByConvError((m) => ({...m, [convId]: true}));
            }
        }
    }

    async function sendMessage(draft) {
        setSendMsgError(false);
        const content = draft.trim();
        const trimmed = (content ?? "").trim();
        if (!trimmed || !activeId || !myIdRef.current) return;

        const convo = conversations.find((x) => x.id === activeId);
        if (!convo) return;

        try {
            const res = await create_message({
                senderId: myIdRef.current,
                receiverId: convo.receiverId,
                content: trimmed,
                signal: undefined,
            });

            const saved = res.message;
            const newMsg = {
                id: saved.message_id,
                sender: "me",
                content: saved.content,
                ts: Date.parse(saved.created_at),
            };

            setMessagesByConv((prev) => {
                const list = prev[activeId] ? [...prev[activeId], newMsg] : [newMsg];
                return {...prev, [activeId]: list};
            });

        } catch (err) {
            setSendMsgError(true);
        }
    }
    
    useEffect(() => {
        // clear any previous interval when activeId changes / unmounts
        if (pollTimerRef.current) {
            clearInterval(pollTimerRef.current);
            pollTimerRef.current = null
        }

        // if no active chat, return
        if (!activeId) return;
        // only poll when the tab is visible to reduce noise
        const shouldPollNow = () => document.visibilityState === "visible";

        const tick = async() => {
            if (!shouldPollNow()) return;
            // new AbortController per tick avoids overlapping slow requests
            const controller = new AbortController();
            try {
                const sinceMs = lastTsRefByConv.current[activeId] || 0;
                const res = await fetch_new_messages(activeId, sinceMs, controller.signal);
                const raw = res.messages
                if (!raw.length) return;

                const incoming = raw.map((m) => {
                    return {
                        id: m.message_id,
                        sender: m.sender_id === myIdRef.current ? "me" : "them",
                        content: m.content,
                        ts: Date.parse(m.created_at),
                    }
                });

                setMessagesByConv((prev) => {
                    const existing = prev[activeId] ?? [];
                    const seen = new Set(existing.map((m) => m.id));
                    const merged = existing.concat(incoming.filter((m) => !seen.has(m.id)));
                    return {...prev, [activeId]: merged};
                });

                const maxTs = Math.max(...incoming.map((m) => Number(m.ts) || 0));
                    lastTsRefByConv.current[activeId] = Math.max(
                    lastTsRefByConv.current[activeId] || 0,
                    maxTs
                );

                console.log(maxTs);

            } catch (err) {
                throw new Error(`failed to read new messages}`);
            }
        };
        tick();
        const handle = setInterval(tick, POLL_MS);
        return () => {
            if (handle) clearInterval(handle);
        };
    }, [activeId]);

    const messages = useMemo(() => messagesByConv[activeId] || [], [messagesByConv, activeId]);

    const value = {
        // state
        conversations,
        activeId,
        messages,
        convError,
        chatByConvError,
        sendMsgError,
        // actions
        selectConversation,
        sendMessage,
        // config (optional: useful for tests or dynamic tuning)
        _config: { POLL_MS, CONV_REFRESH_MS },
  };

    return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used within <ChatProvider>");
  return ctx;
}