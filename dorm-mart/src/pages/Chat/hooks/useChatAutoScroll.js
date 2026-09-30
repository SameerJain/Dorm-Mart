import { useEffect } from "react";

function scrollToBottom(ref) {
  const el = ref.current;
  if (!el) return;
  const rafId = requestAnimationFrame(() => {
    el.scrollTop = el.scrollHeight;
  });
  return () => cancelAnimationFrame(rafId);
}

/** Auto-scroll the message pane to the bottom on conversation/message/typing changes. */
export default function useChatAutoScroll(
  scrollRef,
  { activeConvId, messageCount, isOtherPersonTyping },
) {
  useEffect(() => {
    return scrollToBottom(scrollRef);
    // Note: Removed automatic hiding of typing indicator on messages.length change
    // The backend already handles typing status expiration, and this was causing
    // race conditions where the indicator would disappear when messages were being fetched
  }, [scrollRef, activeConvId, messageCount]);

  useEffect(() => {
    if (isOtherPersonTyping) return scrollToBottom(scrollRef);
  }, [scrollRef, isOtherPersonTyping]);
}
