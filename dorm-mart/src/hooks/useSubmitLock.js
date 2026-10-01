import { useCallback, useRef } from "react";

/**
 * Guards an async action against overlapping runs.
 *
 * A `loading` flag kept in state does not take effect until the next render, so
 * a fast double-click or a held Enter key can start a second run before the
 * button actually disables. A ref closes that window synchronously, and running
 * the action through one wrapper means every exit path releases the lock —
 * including the early returns that manual guards tend to miss.
 *
 * @returns {(action: () => unknown) => Promise<unknown>} Runs `action` unless a
 *   previous run is still in flight, in which case it resolves to undefined.
 */
export function useSubmitLock() {
  const lockedRef = useRef(false);

  return useCallback(async (action) => {
    if (lockedRef.current) return undefined;
    lockedRef.current = true;
    try {
      return await action();
    } finally {
      lockedRef.current = false;
    }
  }, []);
}
