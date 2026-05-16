import { useCallback, useEffect, useRef } from "react";
import { API_BASE } from "../../../utils/apiConfig";
import { csrfFetch } from "../../../utils/csrfFetch";
import logger from "../../../utils/logger";

export default function useChatTypingStatus({
  activeConvId,
  conversations,
  setDraft,
  taRef,
}) {
  const typingTimeoutRef = useRef(null);
  const typingStatusTimeoutRef = useRef(null);
  const currentConvIdRef = useRef(null);
  const sendTypingAbortControllerRef = useRef(null);
  const lastTypingStatusSentRef = useRef(false);
  const isMountedRef = useRef(true);
  const typingRequestSequenceRef = useRef(0);
  const pendingTypingFalseTimeoutRef = useRef(null);
  const typingStartedAtRef = useRef(null);

  const clearTypingTimers = useCallback(() => {
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
  }, []);

  const abortTypingRequest = useCallback(() => {
    if (sendTypingAbortControllerRef.current) {
      sendTypingAbortControllerRef.current.abort();
      sendTypingAbortControllerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!activeConvId) {
      currentConvIdRef.current = null;
      lastTypingStatusSentRef.current = false;
      typingStartedAtRef.current = null;
      clearTypingTimers();
      abortTypingRequest();
      return;
    }

    const previousConvId = currentConvIdRef.current;
    currentConvIdRef.current = activeConvId;
    lastTypingStatusSentRef.current = false;
    typingStartedAtRef.current = null;

    // Invalidate in-flight typing responses from the previous conversation.
    if (previousConvId !== activeConvId) {
      typingRequestSequenceRef.current = 0;
    }

    return () => {
      clearTypingTimers();
      abortTypingRequest();
    };
  }, [activeConvId, abortTypingRequest, clearTypingTimers]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      clearTypingTimers();
      abortTypingRequest();
    };
  }, [abortTypingRequest, clearTypingTimers]);

  const sendTypingStatus = useCallback(async (conversationId, isTyping) => {
    if (!conversationId || !isMountedRef.current) return;
    if (currentConvIdRef.current !== conversationId) return;

    const sequenceNumber = ++typingRequestSequenceRef.current;

    if (sendTypingAbortControllerRef.current) {
      sendTypingAbortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    sendTypingAbortControllerRef.current = abortController;

    try {
      const response = await csrfFetch(`${API_BASE}/chat/typing_status.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        signal: abortController.signal,
        body: JSON.stringify({
          conversation_id: conversationId,
          is_typing: isTyping,
          timestamp: Date.now(),
        }),
      });

      if (
        response.ok &&
        currentConvIdRef.current === conversationId &&
        isMountedRef.current &&
        sequenceNumber === typingRequestSequenceRef.current
      ) {
        lastTypingStatusSentRef.current = isTyping;
      }
    } catch (error) {
      if (error.name !== "AbortError") {
        logger.warn("Failed to send typing status:", error);
      }
    }
  }, []);

  const handleDraftChange = useCallback(
    (e) => {
      const currentConv = conversations.find((c) => c.conv_id === activeConvId);
      if (currentConv?.item_deleted) {
        e.preventDefault();
        e.stopPropagation();
        if (taRef.current) {
          taRef.current.value = "";
          taRef.current.blur();
        }
        setDraft("");
        return false;
      }

      setDraft(e.target.value);

      if (!activeConvId || !isMountedRef.current) return;
      const convId = activeConvId;
      if (currentConvIdRef.current !== convId) return;

      // Clear stale timers before sending typing=true so an older stopped event cannot win.
      clearTypingTimers();

      const hasSentTyping = lastTypingStatusSentRef.current === true;
      const now = Date.now();
      if (!typingStartedAtRef.current) {
        typingStartedAtRef.current = now;
      }

      const typingDuration = now - typingStartedAtRef.current;
      const shouldShowTyping = typingDuration < 30000;

      if (!hasSentTyping && shouldShowTyping) {
        sendTypingStatus(convId, true);
      } else if (hasSentTyping && shouldShowTyping) {
        typingTimeoutRef.current = setTimeout(() => {
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

      typingStatusTimeoutRef.current = setTimeout(() => {
        if (currentConvIdRef.current === convId && isMountedRef.current) {
          typingStatusTimeoutRef.current = null;
          sendTypingStatus(convId, false);
          lastTypingStatusSentRef.current = false;
          typingStartedAtRef.current = null;
        }
      }, 1500);
    },
    [
      activeConvId,
      clearTypingTimers,
      conversations,
      sendTypingStatus,
      setDraft,
      taRef,
    ],
  );

  const flushTypingOnSend = useCallback(() => {
    const convId = activeConvId;
    if (!convId || currentConvIdRef.current !== convId || !isMountedRef.current)
      return;

    clearTypingTimers();
    sendTypingStatus(convId, false);
    lastTypingStatusSentRef.current = false;
    typingStartedAtRef.current = null;
  }, [activeConvId, clearTypingTimers, sendTypingStatus]);

  return { handleDraftChange, flushTypingOnSend };
}
