import {
  createContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation } from "react-router-dom";
import { fetch_me, fetch_conversations, fetch_conversation, create_message, tick_fetch_new_messages, fetch_unread_msg_count } from "./chat_context_utils";

export const ChatContext = createContext(null);

export function ChatProvider({ children }) {
    const POLL_MS = 1000;
    const CONV_REFRESH_MS = 15000;    const pollTimerRef = useRef(null);
    const lastTsRefByConv = useRef({}); // { [convId]: last-message-ts }
    const location = useLocation();
    const isOnChatRoute = location.pathname.startsWith("/app/chat");

    const [myId, setMyId] = useState(null);
    const myIdRef = useRef(null);
    useEffect(() => { myIdRef.current = myId; }, [myId]);

    // chat
    const [conversations, setConversations] = useState([]);
    const [activeConvId, setActiveConvId] = useState(null);
    const [messagesByConv, setMessagesByConv] = useState({});
    const [convError, setConvError] = useState(false);
    const [chatByConvError, setChatByConvError] = useState({});
    const [sendMsgError, setSendMsgError] = useState({});

    // notification
    

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
                        conv_id: c.conv_id,
                        receiverId: iAmUser1 ? c.user2_id : c.user1_id,
                        receiverName: iAmUser1 ? c.user2_fname : c.user1_fname,
                    };
                });

                const unreads = await fetch_unread_msg_count(controller.singal);

                console.log(view);
                console.log(unreads.unreads);

                setConversations(view);
            } catch (err) {
                setConvError(true);
            }
        })();

        return () => controller.abort();
    }, []);

    async function fetchConversation(convId) {
        setActiveConvId(convId);
        setChatByConvError((m) => ({...m, [convId]: false}));

        const controler = new AbortController();
        try {
            const res = await fetch_conversation(convId, controler.signal)
            if (!res.success) {
                throw new Error("Failed to load conversations");
            }

            const raw = res.messages || [];
            const normalized = raw.map((m) => {
                return {
                    message_id: m.message_id,
                    sender: m.sender_id === myIdRef.current ? "me" : "them",
                    content: m.content,
                    ts: Date.parse(m.created_at),
                }
            });

            setMessagesByConv((prev) => ({...prev, [convId]: normalized}));            
            lastTsRefByConv.current[convId] = normalized.length
            ? Math.max(...normalized.map((m) => Number(m.ts) || 0))
            : 0;

        } catch(err) {
            if (err.name !== "AbortError") {
                setChatByConvError((m) => ({...m, [convId]: true}));
            }
        }
    }

    async function createMessage(draft) {
        setSendMsgError(false);
        const content = draft.trim();
        const trimmed = (content ?? "").trim();
        if (!trimmed || !activeConvId || !myIdRef.current) return;

        const convo = conversations.find((c) => c.conv_id === activeConvId);
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
                message_id: saved.message_id,
                sender: "me",
                content: saved.content,
                ts: Date.parse(saved.created_at),
            };

            setMessagesByConv((prev) => {
                const list = prev[activeConvId] ? [...prev[activeConvId], newMsg] : [newMsg];
                return {...prev, [activeConvId]: list};
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

        // if not in chat, or no active conversation, do nothing
        if (!isOnChatRoute || !activeConvId) return;

        const shouldPollNow = () => document.visibilityState === "visible";

        const tick = async() => {
            if (!shouldPollNow()) return;
            // new AbortController per tick avoids overlapping slow requests
            const controller = new AbortController();
            try {
                const sinceSec = Math.floor((lastTsRefByConv.current[activeConvId] || 0) / 1000);
                const incoming = await tick_fetch_new_messages(activeConvId, myIdRef.current, sinceSec, controller.singal);
                if (!incoming.length) return;
    
                setMessagesByConv((prev) => {
                    const existing = prev[activeConvId] ?? [];
                    const seen = new Set(existing.map((m) => m.message_id));
                    const merged = existing.concat(incoming.filter((m) => !seen.has(m.message_id)));
                    return {...prev, [activeConvId]: merged};
                });

                const maxTs = Math.max(...incoming.map((m) => Number(m.ts) || 0));
                    lastTsRefByConv.current[activeConvId] = Math.max(
                    lastTsRefByConv.current[activeConvId] || 0,
                    maxTs
                );

                console.log(maxTs);

            } catch (err) {
                throw new Error(`failed to read new messages}`);
            }
        };

        // tick();
        const handle = setInterval(tick, POLL_MS);
        return () => {
            if (handle) clearInterval(handle);
        };
    }, [activeConvId, isOnChatRoute]);

    const messages = useMemo(() => messagesByConv[activeConvId] || [], [messagesByConv, activeConvId]);

    const value = {
        // state
        conversations,
        activeConvId,
        messages,
        convError,
        chatByConvError,
        sendMsgError,
        // actions
        fetchConversation,
        createMessage,
        // config (optional: useful for tests or dynamic tuning)
        _config: { POLL_MS, CONV_REFRESH_MS },
  };

    return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}
