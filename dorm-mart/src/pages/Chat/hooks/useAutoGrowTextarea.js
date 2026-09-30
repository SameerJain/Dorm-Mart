import { useCallback, useLayoutEffect, useRef } from "react";
import {
  COMPOSER_MIN_HEIGHT_DESKTOP,
  COMPOSER_MIN_HEIGHT_MOBILE,
} from "../utils/chatConstants";

/** Auto-grow a chat textarea between its collapsed height and content height. */
export default function useAutoGrowTextarea(draft) {
  const taRef = useRef(null);

  const autoGrow = useCallback(() => {
    const el = taRef.current;
    if (!el) return;
    const minLine =
      typeof window !== "undefined" &&
      window.matchMedia("(min-width: 768px)").matches
        ? COMPOSER_MIN_HEIGHT_DESKTOP
        : COMPOSER_MIN_HEIGHT_MOBILE;
    if (!(el.value || "").trim()) {
      el.style.height = `${minLine}px`;
      el.style.overflowY = "hidden";
      return;
    }
    el.style.height = "auto";
    const next = Math.max(minLine, el.scrollHeight);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > el.clientHeight ? "auto" : "hidden";
  }, []);

  useLayoutEffect(() => {
    autoGrow();
  }, [draft, autoGrow]);

  return { taRef, autoGrow };
}
