import {
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import { ChatContext } from "../../context/ChatContext";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import ChatComposer from "./components/ChatComposer";
import ChatHeader from "./components/ChatHeader";
import ChatSidebar from "./components/ChatSidebar";
import DeleteConversationModal from "./components/DeleteConversationModal";
import MessageList from "./components/MessageList";
import useChatConversationStatus from "./hooks/useChatConversationStatus";
import { API_BASE } from "../../utils/apiConfig";

/** Root Chat page: wires context, sidebar, messages, and composer together */
export default function ChatPage() {
  /** Chat global state and actions from context */
  const ctx = useContext(ChatContext);
  const {
    conversations,
    activeConvId,
    messages,
    messagesByConv,
    typingStatusByConv,
    convError,
    chatByConvError,
    unreadMsgByConv,
    myId,
    fetchConversation,
    createMessage,
    createImageMessage,
    clearActiveConversation,
    removeConversationLocal,
  } = ctx;

  const [searchParams, setSearchParams] = useSearchParams();
  const MAX_LEN = 500;
  const scrollRef = useRef(null);
  const [draft, setDraft] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [pendingDeleteConvId, setPendingDeleteConvId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [attachOpen, setAttachOpen] = useState(false);
  const typingTimeoutRef = useRef(null);
  const typingStatusTimeoutRef = useRef(null);
  const currentConvIdRef = useRef(null); // Track current active conversation
  const sendTypingAbortControllerRef = useRef(null); // For canceling send typing requests
  const lastTypingStatusSentRef = useRef(false); // Track last sent typing status for reference
  const isMountedRef = useRef(true); // Track if component is mounted
  const typingRequestSequenceRef = useRef(0); // Track request sequence to ignore stale responses
  const pendingTypingFalseTimeoutRef = useRef(null); // Track pending typing=false timeout
  const typingStartedAtRef = useRef(null); // Track when current typing session started (for 30s timeout)

  // Prevent body scroll when delete confirmation modal is open
  useEffect(() => {
    if (deleteConfirmOpen) {
      const scrollY = window.scrollY;
      document.documentElement.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
      document.body.style.position = "fixed";
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = "100%";
    } else {
      const scrollY = document.body.style.top;
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY || "0") * -1);
      }
    }
    return () => {
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
    };
  }, [deleteConfirmOpen]);
  const [attachedImage, setAttachedImage] = useState(null);
  const [usernameMap, setUsernameMap] = useState({});
  const usernameCacheRef = useRef({});
  const pendingUsernameRequests = useRef(new Set());
  useEffect(() => {
    usernameCacheRef.current = usernameMap;
  }, [usernameMap]);

  const taRef = useRef(null);
  const autoGrow = useCallback(() => {
    const el = taRef.current;
    if (!el) return;
    const minLine =
      typeof window !== "undefined" &&
      window.matchMedia("(min-width: 768px)").matches
        ? 44
        : 48;
    const trimmed = (el.value || "").trim();
    if (!trimmed) {
      el.style.height = `${minLine}px`;
      el.style.overflowY = "hidden";
      return;
    }
    el.style.height = "auto";
    const next = Math.max(minLine, el.scrollHeight);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > el.clientHeight ? "auto" : "hidden";
  }, []);

  /** Sync textarea height before paint so composer row stays aligned with attach/send */
  useLayoutEffect(() => {
    autoGrow();
  }, [draft, autoGrow]);

  const navigate = useNavigate();
  const location = useLocation();
  const navigationState =
    location.state && typeof location.state === "object"
      ? location.state
      : null;
  const activeConversation = conversations.find(
    (c) => c.conv_id === activeConvId,
  );

  /** Clear draft when item is deleted and prevent any input */
  useEffect(() => {
    if (activeConversation?.item_deleted) {
      // Clear draft immediately
      setDraft("");
      // Clear textarea value and remove focus
      if (taRef.current) {
        taRef.current.value = "";
        taRef.current.blur();
        // Force the textarea to be disabled
        taRef.current.disabled = true;
        taRef.current.readOnly = true;
      }
    } else {
      // Re-enable if item is not deleted
      if (taRef.current) {
        taRef.current.disabled = false;
        taRef.current.readOnly = false;
      }
    }
  }, [activeConversation?.item_deleted]);

  /** Compute header label for the active chat */
  const activeLabel = useMemo(() => {
    const c = conversations.find((c) => c.conv_id === activeConvId);
    if (c) return c.receiverName;
    if (navigationState?.receiverName) return navigationState.receiverName;
    if (navigationState?.receiverId)
      return `User ${navigationState.receiverId}`;
    return "Select a chat";
  }, [conversations, activeConvId, navigationState]);

  /** Extract first name for mobile display */
  const activeLabelFirstName = useMemo(() => {
    if (!activeLabel || activeLabel === "Select a chat") return activeLabel;
    return activeLabel.split(" ")[0];
  }, [activeLabel]);

  /** Split activeLabel into first and last name for desktop display */
  const { firstName: activeFirstName, lastName: activeLastName } =
    useMemo(() => {
      if (!activeLabel || activeLabel === "Select a chat") {
        return { firstName: activeLabel, lastName: "" };
      }
      const parts = activeLabel.trim().split(/\s+/);
      const firstName = parts[0] || "";
      const lastName = parts.slice(1).join(" ") || "";
      return { firstName, lastName };
    }, [activeLabel]);
  const activeReceiverId =
    activeConversation?.receiverId ?? navigationState?.receiverId ?? null;
  const activeReceiverUsername = activeReceiverId
    ? usernameMap[activeReceiverId]
    : null;
  const activeProfilePath = activeReceiverUsername
    ? `/app/profile?username=${encodeURIComponent(activeReceiverUsername)}`
    : null;

  const ensureUsername = useCallback((userId) => {
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
        const res = await fetch(
          `${API_BASE}/profile/get_username.php?user_id=${encodeURIComponent(userId)}`,
          {
            credentials: "include",
          },
        );
        const json = await res.json().catch(() => null);
        if (res.ok && json?.success && json.username) {
          setUsernameMap((prev) => {
            if (prev[userId]) return prev;
            return { ...prev, [userId]: json.username };
          });
        }
      } catch (_) {
        // ignore errors
      } finally {
        pendingUsernameRequests.current.delete(userId);
      }
    })();
  }, []);

  useEffect(() => {
    conversations.forEach((c) => c?.receiverId && ensureUsername(c.receiverId));
  }, [conversations, ensureUsername]);

  useEffect(() => {
    if (navigationState?.receiverId) {
      ensureUsername(navigationState.receiverId);
    }
  }, [navigationState, ensureUsername]);

  const handleProfileHeaderClick = useCallback(() => {
    if (!activeReceiverId) return;
    if (activeProfilePath) {
      navigate(activeProfilePath);
      return;
    }
    pendingUsernameRequests.current.add(activeReceiverId);
    (async () => {
      try {
        const res = await fetch(
          `${API_BASE}/profile/get_username.php?user_id=${encodeURIComponent(activeReceiverId)}`,
          {
            credentials: "include",
          },
        );
        const json = await res.json().catch(() => null);
        if (res.ok && json?.success && json.username) {
          setUsernameMap((prev) => {
            if (prev[activeReceiverId]) return prev;
            return { ...prev, [activeReceiverId]: json.username };
          });
          navigate(
            `/app/profile?username=${encodeURIComponent(json.username)}`,
          );
        }
      } catch (_) {
        // ignore errors
      } finally {
        pendingUsernameRequests.current.delete(activeReceiverId);
      }
    })();
  }, [activeReceiverId, activeProfilePath, navigate]);

  /** Controls which pane is visible on mobile (list vs messages) */
  const [isMobileList, setIsMobileList] = useState(true);

  /** Handle deep-link via ?conv=ID in URL and auto-open that conversation */
  useEffect(() => {
    const convParam = searchParams.get("conv");
    if (convParam) {
      const convId = parseInt(convParam, 10);
      if (convId && convId !== activeConvId) {
        fetchConversation(convId);
        setIsMobileList(false);
      }
      setSearchParams({});
    }
  }, [searchParams, activeConvId, fetchConversation, setSearchParams]);

  /** When an active conversation exists, show the message pane on mobile */
  useEffect(() => {
    if (activeConvId) setIsMobileList(false);
  }, [activeConvId]);

  // Derive typing status from context (comes from fetch_new_messages)
  const typingStatus = activeConvId
    ? typingStatusByConv[activeConvId] || {
        is_typing: false,
        typing_user_first_name: null,
      }
    : null;
  const isOtherPersonTyping = typingStatus?.is_typing || false;
  const typingUserName = typingStatus?.typing_user_first_name || null;

  /** Cleanup typing-related timeouts and requests when conversation changes */
  useEffect(() => {
    if (!activeConvId) {
      currentConvIdRef.current = null;
      lastTypingStatusSentRef.current = false;
      typingStartedAtRef.current = null; // Reset typing start time
      // Clear all timeouts when no active conversation
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      if (typingStatusTimeoutRef.current) {
        clearTimeout(typingStatusTimeoutRef.current);
        typingStatusTimeoutRef.current = null;
      }
      if (pendingTypingFalseTimeoutRef.current) {
        clearTimeout(pendingTypingFalseTimeoutRef.current);
        pendingTypingFalseTimeoutRef.current = null;
      }
      // Cancel all in-flight requests
      if (sendTypingAbortControllerRef.current) {
        sendTypingAbortControllerRef.current.abort();
        sendTypingAbortControllerRef.current = null;
      }
      return;
    }

    // Reset state when conversation changes
    const previousConvId = currentConvIdRef.current;
    currentConvIdRef.current = activeConvId;
    lastTypingStatusSentRef.current = false;
    typingStartedAtRef.current = null; // Reset typing start time when conversation changes

    // If conversation changed, increment sequence to invalidate any pending requests
    if (previousConvId !== activeConvId) {
      typingRequestSequenceRef.current = 0; // Reset sequence for new conversation
    }

    return () => {
      // Clear all timeouts
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      if (typingStatusTimeoutRef.current) {
        clearTimeout(typingStatusTimeoutRef.current);
        typingStatusTimeoutRef.current = null;
      }
      if (pendingTypingFalseTimeoutRef.current) {
        clearTimeout(pendingTypingFalseTimeoutRef.current);
        pendingTypingFalseTimeoutRef.current = null;
      }

      // Cancel all in-flight requests
      if (sendTypingAbortControllerRef.current) {
        sendTypingAbortControllerRef.current.abort();
        sendTypingAbortControllerRef.current = null;
      }
    };
  }, [activeConvId]);

  /** Component mount/unmount tracking */
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // Cleanup all timeouts and abort controllers on unmount
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      if (typingStatusTimeoutRef.current) {
        clearTimeout(typingStatusTimeoutRef.current);
        typingStatusTimeoutRef.current = null;
      }
      if (pendingTypingFalseTimeoutRef.current) {
        clearTimeout(pendingTypingFalseTimeoutRef.current);
        pendingTypingFalseTimeoutRef.current = null;
      }
      if (sendTypingAbortControllerRef.current) {
        sendTypingAbortControllerRef.current.abort();
        sendTypingAbortControllerRef.current = null;
      }
    };
  }, []);

  /** Auto-scroll to bottom when active conversation or messages change - optimized with requestAnimationFrame */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    // Use requestAnimationFrame for smoother scrolling
    const rafId = requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });

    return () => cancelAnimationFrame(rafId);
    // Note: Removed automatic hiding of typing indicator on messages.length change
    // The backend already handles typing status expiration, and this was causing
    // race conditions where the indicator would disappear when messages were being fetched
  }, [activeConvId, messages.length]);

  /** Auto-scroll to bottom when typing indicator appears - optimized with requestAnimationFrame */
  useEffect(() => {
    if (isOtherPersonTyping) {
      // Use requestAnimationFrame for smoother scrolling
      const rafId = requestAnimationFrame(() => {
        const el = scrollRef.current;
        if (el) {
          el.scrollTop = el.scrollHeight;
        }
      });
      return () => cancelAnimationFrame(rafId);
    }
  }, [isOtherPersonTyping]);

  /** Send typing status to backend with request sequencing to prevent race conditions */
  const sendTypingStatus = useCallback(async (conversationId, isTyping) => {
    if (!conversationId || !isMountedRef.current) return;

    // Verify conversation is still active
    if (currentConvIdRef.current !== conversationId) {
      return;
    }

    // Increment sequence number for this request
    const sequenceNumber = ++typingRequestSequenceRef.current;

    // Cancel any previous send typing requests
    if (sendTypingAbortControllerRef.current) {
      sendTypingAbortControllerRef.current.abort();
    }

    // Create new AbortController for this request
    const abortController = new AbortController();
    sendTypingAbortControllerRef.current = abortController;

    // Include timestamp to help detect stale responses
    const requestTimestamp = Date.now();

    try {
      const response = await fetch(`${API_BASE}/chat/typing_status.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        signal: abortController.signal,
        body: JSON.stringify({
          conversation_id: conversationId,
          is_typing: isTyping,
          timestamp: requestTimestamp,
        }),
      });

      // Only process response if:
      // 1. Response is OK
      // 2. Conversation is still active
      // 3. Component is still mounted
      // 4. This is still the latest request (sequence hasn't advanced)
      if (
        response.ok &&
        currentConvIdRef.current === conversationId &&
        isMountedRef.current &&
        sequenceNumber === typingRequestSequenceRef.current
      ) {
        // Track if we successfully sent typing status
        lastTypingStatusSentRef.current = isTyping;
      }
    } catch (error) {
      // Ignore abort errors - typing indicator is not critical, fail silently
      if (error.name !== "AbortError") {
        // Only log non-abort errors for debugging
        console.warn("Failed to send typing status:", error);
      }
    }
  }, []);

  /** Handle draft input change and track typing status with improved race condition handling */
  const handleDraftChange = useCallback(
    (e) => {
      // Prevent typing if item is deleted
      const currentConv = conversations.find((c) => c.conv_id === activeConvId);
      if (currentConv?.item_deleted) {
        e.preventDefault();
        e.stopPropagation();
        // Force the value to stay empty and prevent any state update
        if (taRef.current) {
          taRef.current.value = "";
          taRef.current.blur(); // Remove focus
        }
        setDraft("");
        return false; // Explicitly return false
      }

      const newValue = e.target.value;
      setDraft(newValue);

      if (!activeConvId || !isMountedRef.current) return;

      // Capture conversation ID to avoid stale closure
      const convId = activeConvId;

      // Verify conversation is still active
      if (currentConvIdRef.current !== convId) {
        return;
      }

      // CRITICAL: Clear ALL existing timeouts FIRST to prevent race conditions
      // This ensures no stale typing=false timeout can fire after we send typing=true
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      if (typingStatusTimeoutRef.current) {
        clearTimeout(typingStatusTimeoutRef.current);
        typingStatusTimeoutRef.current = null;
      }
      if (pendingTypingFalseTimeoutRef.current) {
        clearTimeout(pendingTypingFalseTimeoutRef.current);
        pendingTypingFalseTimeoutRef.current = null;
      }

      // Track if we've sent typing status for this typing session
      const hasSentTyping = lastTypingStatusSentRef.current === true;

      // Track when typing started (for 30-second continuous typing timeout)
      const now = Date.now();
      if (!typingStartedAtRef.current) {
        typingStartedAtRef.current = now;
      }

      // Check if we've been typing continuously for more than 30 seconds
      const typingDuration = now - typingStartedAtRef.current;
      const shouldShowTyping = typingDuration < 30000; // 30 seconds

      // Send "typing" status immediately on first keystroke for instant feedback
      // Then use minimal debounce for subsequent keystrokes to avoid spam
      // But only if we haven't exceeded the 30-second continuous typing limit
      if (!hasSentTyping && shouldShowTyping) {
        // First keystroke - send immediately for instant responsiveness
        if (currentConvIdRef.current === convId && isMountedRef.current) {
          sendTypingStatus(convId, true);
        }
      } else if (hasSentTyping && shouldShowTyping) {
        // Subsequent keystrokes - use minimal debounce (50ms) for smooth updates
        typingTimeoutRef.current = setTimeout(() => {
          // Double-check conversation is still active, component is mounted, and we haven't exceeded timeout
          const currentTypingDuration =
            Date.now() - (typingStartedAtRef.current || Date.now());
          if (
            currentConvIdRef.current === convId &&
            isMountedRef.current &&
            currentTypingDuration < 30000
          ) {
            sendTypingStatus(convId, true);
          }
        }, 50);
      }
      // If typingDuration >= 30000, don't send typing=true updates (indicator will disappear)

      // Send "stopped" status after 1.5s of inactivity (optimized for faster cleanup and responsiveness)
      // Store timeout reference to allow proper cleanup
      typingStatusTimeoutRef.current = setTimeout(() => {
        // Verify conversation is still active and component is mounted before sending
        if (currentConvIdRef.current === convId && isMountedRef.current) {
          // Clear the timeout reference before sending
          typingStatusTimeoutRef.current = null;
          sendTypingStatus(convId, false);
          lastTypingStatusSentRef.current = false;
          typingStartedAtRef.current = null; // Reset typing start time when stopping
        }
      }, 1500);
    },
    [activeConvId, sendTypingStatus, conversations],
  );

  /** Wrapper to prevent message creation when item is deleted */
  const handleCreateMessage = useCallback(
    (content) => {
      if (activeConversation?.item_deleted) {
        return;
      }
      createMessage(content);
    },
    [activeConversation?.item_deleted, createMessage],
  );

  /** Wrapper to prevent image message creation when item is deleted */
  const handleCreateImageMessage = useCallback(
    (content, file) => {
      if (activeConversation?.item_deleted) {
        return;
      }
      createImageMessage(content, file);
    },
    [activeConversation?.item_deleted, createImageMessage],
  );

  const flushTypingOnSend = useCallback(() => {
    const convId = activeConvId;
    if (!convId || currentConvIdRef.current !== convId || !isMountedRef.current)
      return;
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    if (typingStatusTimeoutRef.current) {
      clearTimeout(typingStatusTimeoutRef.current);
      typingStatusTimeoutRef.current = null;
    }
    if (pendingTypingFalseTimeoutRef.current) {
      clearTimeout(pendingTypingFalseTimeoutRef.current);
      pendingTypingFalseTimeoutRef.current = null;
    }
    sendTypingStatus(convId, false);
    lastTypingStatusSentRef.current = false;
    typingStartedAtRef.current = null;
  }, [activeConvId, sendTypingStatus]);

  /** Send text and/or attached image (Enter key or Send button) */
  const submitComposer = useCallback(() => {
    if (activeConversation?.item_deleted || !activeConvId) return;
    if (attachedImage) {
      handleCreateImageMessage(draft, attachedImage);
      setDraft("");
      setAttachedImage(null);
      flushTypingOnSend();
      return;
    }
    if (!draft.trim()) return;
    handleCreateMessage(draft);
    setDraft("");
    setAttachedImage(null);
    flushTypingOnSend();
  }, [
    activeConvId,
    activeConversation?.item_deleted,
    attachedImage,
    draft,
    flushTypingOnSend,
    handleCreateImageMessage,
    handleCreateMessage,
  ]);

  const canSendMessage =
    Boolean(activeConvId) &&
    !activeConversation?.item_deleted &&
    (Boolean(attachedImage) || draft.trim().length > 0);

  /** Keydown handler for textarea: submit on Enter (without Shift) */
  function handleKeyDown(e) {
    if (activeConversation?.item_deleted) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      return false;
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submitComposer();
    }
  }

  /** Open delete confirmation modal for a given conversation */
  function handleDeleteClick(convId, e) {
    e.stopPropagation();
    setPendingDeleteConvId(convId);
    setDeleteConfirmOpen(true);
    setDeleteError("");
  }

  /** Confirm deletion: call API, clear active if needed, then reload page */
  async function handleDeleteConfirm() {
    if (!pendingDeleteConvId || isDeleting) return;

    const convId = pendingDeleteConvId; // keep a local copy
    const wasActive = convId === activeConvId; // was this the open chat?

    // Immediately update local UI and stop polling for this conversation
    removeConversationLocal(convId);
    if (wasActive) {
      clearActiveConversation();
    }

    setIsDeleting(true);
    setDeleteError("");

    try {
      const res = await fetch(`${API_BASE}/chat/delete_conversation.php`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ conv_id: convId }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to delete conversation");
      }

      const result = await res.json();
      if (!result.success) {
        throw new Error(result.error || "Failed to delete conversation");
      }

      setDeleteConfirmOpen(false);
      setPendingDeleteConvId(null);

      // Optional: you probably don't need this anymore, but you can keep it as a safety net.
      // window.location.reload();
    } catch (error) {
      setDeleteError(
        error.message || "Failed to delete conversation. Please try again.",
      );
      // If you want to "undo" the local removal on error, you could reload or refetch here.
    } finally {
      setIsDeleting(false);
    }
  }

  /** Cancel deletion: close modal and clear state */
  function handleDeleteCancel() {
    setDeleteConfirmOpen(false);
    setPendingDeleteConvId(null);
    setDeleteError("");
  }

  /** Helper to parse metadata once and cache it */
  const parseMetadata = useCallback((metadata) => {
    if (!metadata) return null;
    if (typeof metadata === "object") return metadata;
    try {
      return JSON.parse(metadata);
    } catch {
      return null;
    }
  }, []);

  /** Determine if current user is the seller (seller perspective) */
  const isSellerPerspective =
    activeConversation?.productId &&
    activeConversation?.productSellerId &&
    myId &&
    Number(activeConversation.productSellerId) === Number(myId);

  const {
    checkActiveScheduledPurchase,
    checkConfirmStatus,
    confirmStatus,
    hasActiveScheduledPurchase,
  } = useChatConversationStatus({
    activeConvId,
    activeConversation,
    isSellerPerspective,
    messagesLength: messages.length,
    myId,
  });

  /** Check if buyer has accepted confirm purchase and should see review prompt - memoized */
  const {
    hasAcceptedConfirm,
    shouldShowReviewPrompt,
    shouldShowBuyerRatingPrompt,
  } = useMemo(() => {
    const accepted = messages.some((m) => {
      const meta = parseMetadata(m.metadata);
      const msgType = meta?.type;
      return (
        msgType === "confirm_accepted" || msgType === "confirm_auto_accepted"
      );
    });
    const showReview =
      !isSellerPerspective && accepted && activeConversation?.productId;
    const showBuyerRating =
      isSellerPerspective &&
      accepted &&
      activeConversation?.productId &&
      activeReceiverId;
    return {
      hasAcceptedConfirm: accepted,
      shouldShowReviewPrompt: showReview,
      shouldShowBuyerRatingPrompt: showBuyerRating,
    };
  }, [
    messages,
    isSellerPerspective,
    activeConversation?.productId,
    activeReceiverId,
    parseMetadata,
  ]);

  /** Memoize filtered messages computation to avoid re-running complex logic on every render */
  const filteredMessages = useMemo(() => {
    if (!messages.length) return [];

    // Filter out duplicate confirm_request messages if a response exists
    // Build a map of confirm_request_id to response messages
    const confirmResponses = new Map();
    const confirmRequestIds = new Set(); // Track all confirm_request_ids we've seen
    let latestConfirmAcceptedTs = null;

    // Pre-parse all metadata once to avoid repeated parsing
    const messagesWithParsedMetadata = messages.map((m) => ({
      ...m,
      parsedMetadata: parseMetadata(m.metadata),
    }));

    // First pass: identify all confirm_request messages and their IDs
    messagesWithParsedMetadata.forEach((m) => {
      const metadata = m.parsedMetadata;
      const messageType = metadata?.type;
      const confirmRequestId = metadata?.confirm_request_id;

      if (messageType === "confirm_request" && confirmRequestId) {
        confirmRequestIds.add(confirmRequestId);
      }
    });

    // Second pass: identify response messages and map them to request IDs
    messagesWithParsedMetadata.forEach((m) => {
      const metadata = m.parsedMetadata;
      const messageType = metadata?.type;
      const confirmRequestId = metadata?.confirm_request_id;

      // Check if this is a response message
      if (
        confirmRequestId &&
        (messageType === "confirm_accepted" ||
          messageType === "confirm_denied" ||
          messageType === "confirm_auto_accepted")
      ) {
        // Track that we have a response for this confirm_request_id
        confirmResponses.set(confirmRequestId, true);

        // Track the latest confirm_accepted/confirm_auto_accepted timestamp
        if (
          (messageType === "confirm_accepted" ||
            messageType === "confirm_auto_accepted") &&
          m.ts
        ) {
          if (!latestConfirmAcceptedTs || m.ts > latestConfirmAcceptedTs) {
            latestConfirmAcceptedTs = m.ts;
          }
        }
      }

      // Also check enriched metadata for confirm_purchase_status
      // This handles cases where backend enriches messages with status
      const enrichedStatus = metadata?.confirm_purchase_status;
      if (
        confirmRequestId &&
        enrichedStatus &&
        (enrichedStatus === "buyer_accepted" ||
          enrichedStatus === "buyer_declined" ||
          enrichedStatus === "auto_accepted")
      ) {
        confirmResponses.set(confirmRequestId, true);

        if (
          (enrichedStatus === "buyer_accepted" ||
            enrichedStatus === "auto_accepted") &&
          m.ts
        ) {
          if (!latestConfirmAcceptedTs || m.ts > latestConfirmAcceptedTs) {
            latestConfirmAcceptedTs = m.ts;
          }
        }
      }
    });

    // Filter messages: hide confirm_request if a response exists for the same confirm_request_id
    // Also deduplicate: if multiple response messages exist for the same confirm_request_id, keep only the latest one
    const responseMessagesByRequestId = new Map(); // Track confirm_request_id -> array of response messages

    // First, collect all response messages grouped by confirm_request_id
    messagesWithParsedMetadata.forEach((m) => {
      const metadata = m.parsedMetadata;
      const messageType = metadata?.type;
      const confirmRequestId = metadata?.confirm_request_id;

      if (
        confirmRequestId &&
        (messageType === "confirm_accepted" ||
          messageType === "confirm_denied" ||
          messageType === "confirm_auto_accepted")
      ) {
        if (!responseMessagesByRequestId.has(confirmRequestId)) {
          responseMessagesByRequestId.set(confirmRequestId, []);
        }
        responseMessagesByRequestId.get(confirmRequestId).push(m);
      }
    });

    // For each confirm_request_id with responses, find the latest one
    const latestResponseByRequestId = new Map();
    responseMessagesByRequestId.forEach(
      (responseMessages, confirmRequestId) => {
        // Sort by timestamp descending and take the first (latest) one
        const sorted = responseMessages.sort((a, b) => {
          const tsA = a.ts || 0;
          const tsB = b.ts || 0;
          return tsB - tsA; // Descending order
        });
        latestResponseByRequestId.set(confirmRequestId, sorted[0]);
      },
    );

    // Now filter messages
    let filtered = messagesWithParsedMetadata.filter((m) => {
      const metadata = m.parsedMetadata;
      const messageType = metadata?.type;
      const confirmRequestId = metadata?.confirm_request_id;

      // If this is a confirm_request and we have a response for it, hide it
      // This ensures only the response message (confirm_accepted/confirm_denied) is shown
      if (
        messageType === "confirm_request" &&
        confirmRequestId &&
        confirmResponses.has(confirmRequestId)
      ) {
        return false; // Hide this message
      }

      // If this is a response message, only show it if it's the latest one for this confirm_request_id
      if (
        confirmRequestId &&
        (messageType === "confirm_accepted" ||
          messageType === "confirm_denied" ||
          messageType === "confirm_auto_accepted")
      ) {
        const latestResponse = latestResponseByRequestId.get(confirmRequestId);
        // Only show this message if it's the latest one (same message object reference)
        return latestResponse === m;
      }

      return true; // Show this message
    });

    // Insert virtual messages for review/rating prompts right after the latest confirm_accepted message
    if (
      latestConfirmAcceptedTs !== null &&
      hasAcceptedConfirm &&
      activeConversation?.productId
    ) {
      const virtualMessages = [];

      // Add review prompt for buyers
      if (shouldShowReviewPrompt) {
        virtualMessages.push({
          message_id: `review_prompt_${activeConversation.productId}`,
          sender: "system",
          content: "",
          ts: latestConfirmAcceptedTs + 1, // Place right after confirm_accepted
          metadata: {
            type: "review_prompt",
          },
          parsedMetadata: { type: "review_prompt" },
        });
      }

      // Add buyer rating prompt for sellers
      if (shouldShowBuyerRatingPrompt && activeReceiverId) {
        virtualMessages.push({
          message_id: `buyer_rating_prompt_${activeConversation.productId}_${activeReceiverId}`,
          sender: "system",
          content: "",
          ts: latestConfirmAcceptedTs + 2, // Place after review prompt if both exist
          metadata: {
            type: "buyer_rating_prompt",
          },
          parsedMetadata: { type: "buyer_rating_prompt" },
        });
      }

      // Insert virtual messages into the array and sort by timestamp
      filtered = [...filtered, ...virtualMessages].sort((a, b) => {
        const tsA = a.ts || 0;
        const tsB = b.ts || 0;
        if (tsA !== tsB) return tsA - tsB;
        // If timestamps are equal, ensure virtual messages come after regular messages
        const aMsgId = String(a.message_id || "");
        const bMsgId = String(b.message_id || "");
        const aIsVirtual =
          aMsgId.startsWith("review_prompt_") ||
          aMsgId.startsWith("buyer_rating_prompt_");
        const bIsVirtual =
          bMsgId.startsWith("review_prompt_") ||
          bMsgId.startsWith("buyer_rating_prompt_");
        if (aIsVirtual && !bIsVirtual) return 1;
        if (!aIsVirtual && bIsVirtual) return -1;
        return 0;
      });
    }

    return filtered;
  }, [
    messages,
    hasAcceptedConfirm,
    activeConversation?.productId,
    shouldShowReviewPrompt,
    shouldShowBuyerRatingPrompt,
    activeReceiverId,
    parseMetadata,
  ]);

  /** Header background color based on buyer vs seller perspective */
  const headerBgColor = isSellerPerspective
    ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
    : "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800";

  /** Seller-only confirm state (null if not seller perspective) */
  const confirmState = isSellerPerspective
    ? (confirmStatus ?? {
        can_confirm: false,
        message: "Checking Confirm Purchase status…",
      })
    : null;

  /** Disable Confirm Purchase button if cannot confirm */
  const confirmButtonDisabled = confirmState ? !confirmState.can_confirm : true;
  /** Tooltip/title text for Confirm Purchase button */
  const confirmButtonTitle = confirmState?.message || "";

  /** Navigate to Schedule Purchase flow for seller */
  function handleSchedulePurchase() {
    if (
      !activeConvId ||
      !activeConversation?.productId ||
      hasActiveScheduledPurchase
    )
      return;
    navigate("/app/seller-dashboard/schedule-purchase", {
      state: { convId: activeConvId, productId: activeConversation.productId },
    });
  }

  /** Navigate to Confirm Purchase flow for seller */
  function handleConfirmPurchase() {
    if (!activeConvId || !activeConversation?.productId) return;
    navigate("/app/seller-dashboard/confirm-purchase", {
      state: { convId: activeConvId, productId: activeConversation.productId },
    });
  }

  return (
    <div
      className="h-[100dvh] md:h-[calc(100dvh-var(--nav-h))] w-full bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100"
      style={{ "--nav-h": "64px" }}
    >
      <div className="mx-auto h-full max-w-[1200px] px-4 py-6">
        <div className="grid h-full grid-cols-12 gap-4">
          <ChatSidebar
            activeConvId={activeConvId}
            convError={convError}
            conversations={conversations}
            fetchConversation={fetchConversation}
            handleDeleteClick={handleDeleteClick}
            isMobileList={isMobileList}
            messages={messages}
            myId={myId}
            setIsMobileList={setIsMobileList}
            unreadMsgByConv={unreadMsgByConv}
          />

          <section
            className={
              `col-span-12 md:col-span-8 flex min-h-0 flex-col overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm ` +
              (isMobileList ? "hidden" : "flex") +
              " md:flex"
            }
          >
            <ChatHeader
              activeConvId={activeConvId}
              activeConversation={activeConversation}
              activeFirstName={activeFirstName}
              activeLabel={activeLabel}
              activeLabelFirstName={activeLabelFirstName}
              activeLastName={activeLastName}
              activeReceiverId={activeReceiverId}
              clearActiveConversation={clearActiveConversation}
              handleProfileHeaderClick={handleProfileHeaderClick}
              headerBgColor={headerBgColor}
              isSellerPerspective={isSellerPerspective}
              navigate={navigate}
              setIsMobileList={setIsMobileList}
            />

            <MessageList
              activeConvId={activeConvId}
              activeConversation={activeConversation}
              activeReceiverId={activeReceiverId}
              chatByConvError={chatByConvError}
              checkActiveScheduledPurchase={checkActiveScheduledPurchase}
              checkConfirmStatus={checkConfirmStatus}
              conversations={conversations}
              fetchConversation={fetchConversation}
              filteredMessages={filteredMessages}
              isOtherPersonTyping={isOtherPersonTyping}
              messages={messages}
              messagesByConv={messagesByConv}
              parseMetadata={parseMetadata}
              scrollRef={scrollRef}
              typingUserName={typingUserName}
            />

            <ChatComposer
              MAX_LEN={MAX_LEN}
              activeConversation={activeConversation}
              attachOpen={attachOpen}
              attachedImage={attachedImage}
              autoGrow={autoGrow}
              canSendMessage={canSendMessage}
              confirmButtonDisabled={confirmButtonDisabled}
              confirmButtonTitle={confirmButtonTitle}
              confirmState={confirmState}
              draft={draft}
              handleConfirmPurchase={handleConfirmPurchase}
              handleCreateImageMessage={handleCreateImageMessage}
              handleDraftChange={handleDraftChange}
              handleKeyDown={handleKeyDown}
              handleSchedulePurchase={handleSchedulePurchase}
              hasActiveScheduledPurchase={hasActiveScheduledPurchase}
              isSellerPerspective={isSellerPerspective}
              setAttachOpen={setAttachOpen}
              setAttachedImage={setAttachedImage}
              setDraft={setDraft}
              submitComposer={submitComposer}
              taRef={taRef}
            />
          </section>
        </div>
      </div>

      {deleteConfirmOpen && (
        <DeleteConversationModal
          deleteError={deleteError}
          isDeleting={isDeleting}
          onCancel={handleDeleteCancel}
          onConfirm={handleDeleteConfirm}
        />
      )}
    </div>
  );
}
