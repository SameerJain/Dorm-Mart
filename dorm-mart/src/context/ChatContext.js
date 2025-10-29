import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { getSocket, ensureSocket } from "../server/ws-demo";

const ChatContext = createContext(null);

export function ChatProvider({ children }) {
    // "open" | "connecting" | "closed"
    const [status, setStatus] = useState("closed");
    const wsRef = useRef(null);

    useEffect(()=> {
        const ws = getSocket() || ensureSocket();
        wsRef.current = ws;

        // used to keep ws status within chatContext
        const onOpen = () => setStatus("open");
        const onClose = () => setStatus("closed");
        const onError = () => {}

        // as chatContext mounts, add these listeners
        ws.addEventListener("open",  onOpen);
        ws.addEventListener("close", onClose);
        ws.addEventListener("error", onError);

        // as chatContext unmounts, remove added listeners
        return () => {
            // ws stays connected
            ws.removeEventListener("open",  onOpen);
            ws.removeEventListener("close", onClose);
            ws.removeEventListener("error", onError);
        };

    }, []);

    const api = useMemo(() => ({
        ws: wsRef.current, // direct access if you need it
        wsStatus: status,            // "open" | "connecting" | "closed"

        // Safe sender: only sends if socket is OPEN. Returns boolean success.
        send(type, payload) {
            const s = wsRef.current;
            if (!s || s.readyState !== WebSocket.OPEN) return false;
            s.send(JSON.stringify({ type, payload }));
            return true;
        },

        // Subscribe to messages. Returns an unsubscribe function.
        // Comment: wraps 'message' events and hands you parsed JSON when possible.
        addMessageListener(handler) {
            const s = wsRef.current;
            if (!s) return () => {};
            const fn = (e) => {
                const text = String(e.data);
                try { handler(JSON.parse(text)); }
                catch { handler({ type: "text", payload: text }); }
            };
            s.addEventListener("message", fn);
            return () => s.removeEventListener("message", fn);
        },

    }), [status]); // wsRef.current is stable; status drives UI


    return (
        <ChatContext.Provider value={{api}}>
            {children}
        </ChatContext.Provider>
    );
}

export function useChat() {
    const ctx = useContext(ChatContext);
    if (!ctx) throw new Error("useChat must be used within <ChatProvider>");
    return ctx;
}
