import { useContext, useEffect, useState } from "react";
import { ChatContext } from "../../../context/ChatContext";
import { fetchMe } from "../../../utils/handleAuth";

export default function useCurrentUserId() {
  const chatCtx = useContext(ChatContext);
  const chatMyId = chatCtx?.myId ?? null;
  const [myId, setMyId] = useState(null);

  useEffect(() => {
    if (chatMyId) {
      setMyId(chatMyId);
      return undefined;
    }

    // fetchMe shares one me.php request with the chat context; two parallel
    // calls can race on the rotating remember-me cookie.
    const controller = new AbortController();
    fetchMe(controller.signal)
      .then((json) => {
        if (json?.user_id) setMyId(json.user_id);
      })
      .catch(() => {
        // A logged-out user can still view public item details.
      });
    return () => controller.abort();
  }, [chatMyId]);

  return myId;
}
