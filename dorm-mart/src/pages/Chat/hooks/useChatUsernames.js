import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE } from "../../../utils/apiConfig";

async function fetchUsername(userId) {
  const res = await fetch(
    `${API_BASE}/profile/get_username.php?user_id=${encodeURIComponent(userId)}`,
    {
      credentials: "include",
    },
  );
  const json = await res.json().catch(() => null);
  return res.ok && json?.success && json.username ? json.username : null;
}

export default function useChatUsernames({
  activeReceiverId,
  conversations,
  navigationState,
  navigate,
}) {
  const [usernameMap, setUsernameMap] = useState({});
  const usernameCacheRef = useRef({});
  const pendingUsernameRequests = useRef(new Set());

  useEffect(() => {
    usernameCacheRef.current = usernameMap;
  }, [usernameMap]);

  const setUsername = useCallback((userId, username) => {
    setUsernameMap((prev) => {
      if (prev[userId]) return prev;
      return { ...prev, [userId]: username };
    });
  }, []);

  const ensureUsername = useCallback(
    (userId) => {
      if (
        !userId ||
        usernameCacheRef.current[userId] ||
        pendingUsernameRequests.current.has(userId)
      ) {
        return;
      }
      pendingUsernameRequests.current.add(userId);
      (async () => {
        try {
          const username = await fetchUsername(userId);
          if (username) {
            setUsername(userId, username);
          }
        } catch (_) {
          // ignore errors
        } finally {
          pendingUsernameRequests.current.delete(userId);
        }
      })();
    },
    [setUsername],
  );

  useEffect(() => {
    conversations.forEach((c) => c?.receiverId && ensureUsername(c.receiverId));
  }, [conversations, ensureUsername]);

  useEffect(() => {
    if (navigationState?.receiverId) {
      ensureUsername(navigationState.receiverId);
    }
  }, [navigationState, ensureUsername]);

  const activeReceiverUsername = activeReceiverId
    ? usernameMap[activeReceiverId]
    : null;
  const activeProfilePath = activeReceiverUsername
    ? `/app/profile?username=${encodeURIComponent(activeReceiverUsername)}`
    : null;

  const handleProfileHeaderClick = useCallback(() => {
    if (!activeReceiverId) return;
    if (activeProfilePath) {
      navigate(activeProfilePath);
      return;
    }
    pendingUsernameRequests.current.add(activeReceiverId);
    (async () => {
      try {
        const username = await fetchUsername(activeReceiverId);
        if (username) {
          setUsername(activeReceiverId, username);
          navigate(`/app/profile?username=${encodeURIComponent(username)}`);
        }
      } catch (_) {
        // ignore errors
      } finally {
        pendingUsernameRequests.current.delete(activeReceiverId);
      }
    })();
  }, [activeProfilePath, activeReceiverId, navigate, setUsername]);

  return {
    handleProfileHeaderClick,
  };
}
