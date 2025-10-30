import { createContext, useContext, useState } from "react";

const ChatContext = createContext();

// // consider which methods would be needed to interact with the server
// function get_convs() {

// }

// function get_conv() {

// }

// function send_message() {

// }

// function update_message() {

// }

// function delete_message() {

// }

// function user_authenticated() {
//     // check token
// }

export function ChatProvider({ children }) {
    // consider which states would be needed to control chat
    const [conversations, setChat] = useState();
    const [authenticated, setAuthenticated] = useState();


    return (
        <ChatContext.Provider value={{conversations, authenticated}}>
            {children}
        </ChatContext.Provider>
    );
}

export function useChat() {
    return useContext(ChatContext);
}
