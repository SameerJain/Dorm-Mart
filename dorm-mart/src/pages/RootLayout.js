import { useEffect, useState } from "react";
import { ensureSocket, sendPing, sendMessage} from "../server/ws-demo"
import { Outlet, useNavigate } from "react-router-dom";
import MainNav from "../components/MainNav/MainNav";

function RootLayout() {
  const [ lastMsg, setLastMsg ] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    // retrive ws object
    const s = ensureSocket();

    const onMsg = (e) => {
      let parsed = JSON.parse(e.data);

      switch (parsed.type) {
        case "hello":
          setLastMsg(parsed.payload?.msg);
          break;
        case 'pong':
          setLastMsg(parsed.payload?.msg);
          break;
        case 'message':
          setLastMsg(parsed.payload?.msg);
          break
      }
    }

    s.addEventListener("message", onMsg);
    return () => s.removeEventListener("message", onMsg);
    // Do not do client-side auth checks; rely on server on each protected API call
  }, [navigate]);

  return (
    <>
      <button onClick={sendPing}>ping button</button>
      <div style={{ marginTop: 8 }}>
        Last message: {lastMsg || "—"}
      </div>
      <MainNav />
      <Outlet />
    </>
  );
}

export default RootLayout;
