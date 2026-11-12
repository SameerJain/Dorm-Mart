import { useEffect, useRef } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Keyboard and screen reader behavior for a modal panel: focus moves in when
 * it opens, Tab stays inside it, Escape calls `onClose`, and focus returns to
 * the opener when it closes.
 *
 * Leave `onClose` out for a modal that already handles Escape itself.
 * `dismissible={false}` (e.g. while a request is in flight) ignores Escape.
 */
export function useModalFocus(panelRef, { active = true, onClose, dismissible = true, initialFocusRef } = {}) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const dismissibleRef = useRef(dismissible);
  dismissibleRef.current = dismissible;

  useEffect(() => {
    if (!active) return undefined;
    const previouslyFocused = document.activeElement;
    const panel = panelRef.current;
    const first = initialFocusRef?.current || panel?.querySelector(FOCUSABLE) || panel;
    first?.focus?.();

    function onKeyDown(event) {
      if (event.key === "Escape" && onCloseRef.current && dismissibleRef.current) {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const focusable = Array.from(panel.querySelectorAll(FOCUSABLE));
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const firstEl = focusable[0];
      const lastEl = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === firstEl) {
        event.preventDefault();
        lastEl.focus();
      } else if (!event.shiftKey && document.activeElement === lastEl) {
        event.preventDefault();
        firstEl.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      if (previouslyFocused && typeof previouslyFocused.focus === "function") {
        previouslyFocused.focus();
      }
    };
    // Focus handling runs once per open; later prop changes use the refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
}
