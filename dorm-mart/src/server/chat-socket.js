import { WebSocketServer } from "ws";
import { require_login }

// Chat Socket Server 
const css = new WebSocketServer({ port: 8080 });

const clientByUserId = new Map();

function get_token() {

}

css.on("connection", (ws, req) => {

    const token = 
    const userId = validate_token();

    if (!userId) {
        ws.close(4401, "Unauthorized"); // custom close code + reason
        return;
    }

    if (!clientByUserId.has(userId)) clientByUserId.set(userId, new Set());
    clientByUserId.get(userId).add(ws);

    ws.on("close", () => {
        const set = clientByUserId.get(userId);

        if (set) {
            set.delete(ws);
            if (set.size === 0) clientByUserId.delete(userId);
        }
    });



})