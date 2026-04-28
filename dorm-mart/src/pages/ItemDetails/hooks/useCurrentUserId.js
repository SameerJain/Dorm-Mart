import { useContext, useEffect, useState } from "react";
import { ChatContext } from "../../../context/ChatContext";
import { API_BASE } from "../../../utils/apiConfig";

export default function useCurrentUserId() {
  const chatCtx = useContext(ChatContext);
  const chatMyId = chatCtx?.myId ?? null;
  const [myId, setMyId] = useState(null);

  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      if (chatMyId) {
        setMyId(chatMyId);
        return;
      }

      try {
        const response = await fetch(`${API_BASE}/auth/me.php`, {
          signal: controller.signal,
          credentials: "include",
        });
        if (!response.ok) return;

        const json = await response.json();
        if (json.user_id) {
          setMyId(json.user_id);
        }
      } catch (error) {
        if (error.name !== "AbortError") {
          // A logged-out user can still view public item details.
        }
      }
    })();

    return () => controller.abort();
  }, [chatMyId]);

  return myId;
}
