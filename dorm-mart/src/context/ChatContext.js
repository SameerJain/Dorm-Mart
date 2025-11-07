import {
  createContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation } from "react-router-dom";
import { 
    fetch_me,
    fetch_conversations,
    fetch_conversation,
    create_message,
    tick_fetch_new_messages,
    tick_fetch_unread_messages,
    envBool 
} from "./chat_context_utils";

export const ChatContext = createContext(null);

export function ChatProvider({ children }) {
    const NEW_MSG_POLL_MS = 1000;
    const UNREAD_MSG_POLL_MS = 5000;
    const newMsgPollRef = useRef(null);
    const lastTsRefByConv = useRef({}); // { [convId]: last-message-ts }
    const unreadPollRef = useRef(null);
    const location = useLocation();
    const isOnChatRoute = location.pathname.startsWith("/app/chat");

    const [myId, setMyId] = useState(null);
    const myIdRef = useRef(null);
    useEffect(() => { myIdRef.current = myId; }, [myId]);

    function projectConversationRow(row, currentUserId) {
        if (!row || !currentUserId) return null;
        const convId = Number(row.conv_id);
        const user1Id = Number(row.user1_id);
        const user2Id = Number(row.user2_id);
        if (!Number.isInteger(convId) || !Number.isInteger(user1Id) || !Number.isInteger(user2Id)) {
            return null;
        }
        const iAmUser1 = user1Id === currentUserId;
        const iAmUser2 = user2Id === currentUserId;
        if (!iAmUser1 && !iAmUser2) {
            return null;
        }
        const receiverId = iAmUser1 ? user2Id : user1Id;
        const rawName = iAmUser1 ? (row.user2_fname ?? '') : (row.user1_fname ?? '');
        const receiverName = rawName && rawName.trim() !== '' ? rawName : `User ${receiverId}`;
        return {
            conv_id: convId,
            receiverId,
            receiverName,
        };
    }

    const pendingConversationsRef = useRef([]);
    const conversationsRef = useRef([]);

    function upsertConversationRow(row) {
        const currentId = myIdRef.current;
        const entry = projectConversationRow(row, currentId);
        if (!entry) {
            if (!currentId) {
                const pending = pendingConversationsRef.current;
                const existing = pending.find((c) => Number(c?.conv_id) === Number(row?.conv_id));
                if (!existing) {
                    pending.push(row);
                }
            }
            return null;
        }
        setConversations((prev) => {
            const idx = prev.findIndex((c) => c.conv_id === entry.conv_id);
            if (idx >= 0) {
                const next = [...prev];
                next[idx] = entry;
                return next;
            }
            return [...prev, entry];
        });
        return entry;
    }

    const lastNavConvRef = useRef(null);
    const refreshInFlightRef = useRef(false);

    // chat
    const [conversations, setConversations] = useState([]);
    const [activeConvId, setActiveConvId] = useState(null);
    const [messagesByConv, setMessagesByConv] = useState({});
    const [convError, setConvError] = useState(false);
    const [chatByConvError, setChatByConvError] = useState({});
    const [sendMsgError, setSendMsgError] = useState(false);

    function selectConversation(id) {           // used when opening a chat
        setActiveConvId(id);
        fetchConversation(id);
    }

    function clearActiveConversation() {
        setActiveConvId(null); // stops new-message polling because the effect below bails when no activeConvId
    }

    // notification
    const [unreadByConv, setUnreadByConv] = useState({});  // { [conv_id]: count }
    const [unreadTotal, setUnreadTotal] = useState(0);     // sum of counts

    const loadConversations = async (signal, userIdOverride) => {
        try {
            const res = await fetch_conversations(signal);
            if (!res.success) {
                throw new Error("Failed to load conversations");
            }
            const currentUserId = userIdOverride ?? myIdRef.current;
            if (!currentUserId) return;
            const view = (res.conversations || [])
                .map((c) => projectConversationRow(c, currentUserId))
                .filter(Boolean);

            setConversations(view);
        } catch (err) {
            setConvError(true);
        }
    };

    // on context load, fetch all conversations
    useEffect(() => {
        const controller = new AbortController();

        (async () => {
            try {
                setConvError(false);
                const me = await fetch_me(controller.signal);
                setMyId(me.user_id);
                await loadConversations(controller.signal, me.user_id);
            } catch (err) {
                setConvError(true);
            }
        })();

        return () => controller.abort();
    }, []);

    useEffect(() => {
        conversationsRef.current = conversations;
    }, [conversations]);

    useEffect(() => {
        if (!myId) return;
        if (!pendingConversationsRef.current.length) return;
        const queued = pendingConversationsRef.current.splice(0, pendingConversationsRef.current.length);
        queued.forEach((row) => {
            upsertConversationRow(row);
        });
    }, [myId]);

    useEffect(() => {
        if (!location.pathname.startsWith("/app/chat")) {
            lastNavConvRef.current = null;
            return;
        }

        let convId = null;
        const navState = location.state && typeof location.state === 'object' ? location.state : null;

        if (navState && navState.convId != null) {
            convId = Number(navState.convId);
        }

        if (convId == null && location.search) {
            try {
                const params = new URLSearchParams(location.search);
                const queryConv = params.get('conv');
                if (queryConv) convId = Number(queryConv);
            } catch (_) {
                // ignore malformed query string
            }
        }

        if (convId == null && navState && navState.receiverId != null) {
            const receiverId = Number(navState.receiverId);
            if (!Number.isNaN(receiverId)) {
                const match = conversations.find((c) => c.receiverId === receiverId);
                if (match) convId = match.conv_id;
            }
        }

        if (convId && !Number.isNaN(convId) && convId > 0) {
            if (lastNavConvRef.current !== convId) {
                lastNavConvRef.current = convId;
                fetchConversation(convId);
            }
        }
    }, [location, conversations]);

    // when a chat is selected
    async function fetchConversation(convId) {
        setActiveConvId(convId);
        setChatByConvError((m) => ({...m, [convId]: false}));

        const controller = new AbortController();
        try {
            const res = await fetch_conversation(convId, controller.signal)
            if (!res.success) {
                throw new Error("Failed to load conversations");
            }

            const raw = res.messages || [];
            const normalized = raw.map((m) => {
                const metadata = (() => {
                    if (!m.metadata) return null;
                    if (typeof m.metadata === "object") return m.metadata;
                    try {
                        return JSON.parse(m.metadata);
                    } catch {
                        return null;
                    }
                })();
                return {
                    message_id: m.message_id,
                    sender: m.sender_id === myIdRef.current ? "me" : "them",
                    content: m.content,
                    ts: Date.parse(m.created_at),
                    metadata,
                }
            });

            setMessagesByConv((prev) => ({...prev, [convId]: normalized}));            
            lastTsRefByConv.current[convId] = normalized.length
            ? Math.max(...normalized.map((m) => Number(m.ts) || 0))
            : 0;

            clearUnreadMsgFor(convId);

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
    
    // tick for fetching new messages
    useEffect(() => {
        // clear interval when activeId changes / unmounts or error occurs
        const stopPolling = () => {
            if (newMsgPollRef.current) {
            clearInterval(newMsgPollRef.current);   // stop the repeating timer
            newMsgPollRef.current = null;           // mark “no active interval”
            }
        };

        stopPolling();

        // if not in chat, or no active conversation, do nothing
        if (!isOnChatRoute || !activeConvId) return;

        const shouldPollNow = () => document.visibilityState === "visible";

        // keep a handle to the current in-flight request so we can cancel it properly
        const inFlightRef = { ctrl: null }; // { ctrl: AbortController | null }

        const tick = async() => {
            if (!shouldPollNow()) return;

            // cancel any previous unfinished request before starting a new one
            if (inFlightRef.ctrl) inFlightRef.ctrl.abort();

            const controller = new AbortController();
            inFlightRef.ctrl = controller;

            // new AbortController per tick avoids overlapping slow requests

            try {
                const sinceSec = Math.floor((lastTsRefByConv.current[activeConvId] || 0) / 1000);
                const incoming = await tick_fetch_new_messages(activeConvId, myIdRef.current, sinceSec, controller.signal);
                if (!incoming.length) return;
    
                setMessagesByConv((prev) => {
                    const existing = prev[activeConvId] ?? [];
                    const seen = new Set(existing.map((m) => m.message_id));
                    const merged = existing.concat(incoming.filter((m) => !seen.has(m.message_id)));
                    return {...prev, [activeConvId]: merged};
                });

                clearUnreadMsgFor(activeConvId);

                const maxTs = Math.max(...incoming.map((m) => Number(m.ts) || 0));
                    lastTsRefByConv.current[activeConvId] = Math.max(
                    lastTsRefByConv.current[activeConvId] || 0,
                    maxTs
                );

            } catch (e) {
                if (e.name !== "AbortError") stopPolling();
            } finally {
                // IMPORTANT: do NOT abort here — aborting after completion makes
                // Chrome mark the request as (canceled) in the Network tab.
                inFlightRef.ctrl = null; // clear handle; request is done
            }
        };

        tick(); // run once immediately
        newMsgPollRef.current = setInterval(tick, NEW_MSG_POLL_MS);

        return () => {
            stopPolling();
            // abort any in-flight request on unmount/dep-change
            if (inFlightRef.ctrl) inFlightRef.ctrl.abort();
        };
    }, [activeConvId, isOnChatRoute]);

    function clearUnreadMsgFor(convId) {
    setUnreadByConv((prev) => {
        const prevCnt = Number(prev[convId]) || 0;   // normalize
        if (prevCnt === 0) return prev;              // nothing to clear

        const next = { ...prev };
        delete next[convId];                         // drop this convo’s badge

        setUnreadTotal((t) => Math.max(0, (Number(t) || 0) - prevCnt)); // keep total in sync
        return next;
        });
    };

    // tick for fetching unread messages
    useEffect(() => {
        // clear any previous unread interval
        const stopPolling = () => {
            if (unreadPollRef.current) {
            clearInterval(unreadPollRef.current);   // stop the repeating timer
            unreadPollRef.current = null;           // mark “no active interval”
            }
        };
        stopPolling();

        const notificationOn = envBool(process.env.REACT_APP_CHAT_NOTIFICATION_ON, true);
        if (!notificationOn) return;
        if (!myId) return;
        
        const shouldPollNow = () => document.visibilityState === "visible";

        const tick = async () => {
            if (!shouldPollNow()) return;
            const controller = new AbortController();
            try {
                const { unreads, total } = await tick_fetch_unread_messages(controller.signal);
                setUnreadByConv(unreads);
                setUnreadTotal(total);

                const currentConvs = conversationsRef.current;
                const convIds = new Set(currentConvs.map((c) => c.conv_id));
                const missing = Object.keys(unreads || {})
                    .map((id) => Number(id))
                    .filter((id) => id && !convIds.has(id));

                if (missing.length && !refreshInFlightRef.current) {
                    refreshInFlightRef.current = true;
                    try {
                        await loadConversations();
                    } finally {
                        refreshInFlightRef.current = false;
                    }
                }
            } catch (e) {
               stopPolling();
            } finally {
                controller.abort();
            }
        };

        tick();
        unreadPollRef.current = setInterval(tick, UNREAD_MSG_POLL_MS);
        return stopPolling;
    }, [UNREAD_MSG_POLL_MS, myId]);

    const messages = useMemo(() => messagesByConv[activeConvId] || [], [messagesByConv, activeConvId]);

    const value = {
        // chat state
        conversations,
        activeConvId,
        messages,
        convError,
        chatByConvError,
        sendMsgError,
        // unread state
        unreadByConv,
        unreadTotal,
        // actions
        fetchConversation,
        createMessage,
        clearActiveConversation,
        registerConversation: upsertConversationRow,
        // config (optional: useful for tests or dynamic tuning)
        _config: { POLL_MS: NEW_MSG_POLL_MS, UNREAD_MSG_POLL_MS },
  };

    return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}
