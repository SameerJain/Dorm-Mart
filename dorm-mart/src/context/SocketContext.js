import { createContext, useContext, useState, useRef } from "react";
import ChatSocket from '../server/web-socket';
import { get_user_id } from "../utils/handle_auth";
const SocketContext = createContext();

export function SocketProvider({ children }) {
    

    const sockRef = useRef(null);
    const [authenticated, setAuthenticated] = useState();

    useEffect(() => {
        let closed = false;
        const user_id = get_user_id();
        // hostname: http://localhost:3000 -> localhost 
        // or https://aptitude.cse.buffalo.edu/CSE442/... -> aptitude.cse.buffalo.edu
        sockRef.current = new ChatSocket({
            wsUrl: `ws://${window.location.hostname}:8081`,
            userId: user_id,
            
        })
    })

    return (
        <ChatContext.Provider value={{chat, authenticated}}>
            {children}
        </ChatContext.Provider>
    );
}

export function useChat() {
    return useContext(ChatContext);
}