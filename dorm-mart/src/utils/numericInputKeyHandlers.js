/** Keys that should never be blocked in numeric fields */
const NAV_KEYS = new Set([
  "Backspace",
  "Delete",
  "Tab",
  "Escape",
  "Enter",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Home",
  "End",
]);

function shouldAllowUnmodified(e) {
  if (e.ctrlKey || e.metaKey || e.altKey) return true;
  if (e.key === "Unidentified" || e.key === "Process") return true;
  return false;
}

/**
 * Digits and a single "." — blocks e/E/+/- and all letters.
 */
export function decimalNumericKeyDownHandler(e) {
  if (NAV_KEYS.has(e.key)) return;
  if (shouldAllowUnmodified(e)) return;
  if (/^\d$/.test(e.key)) return;
  if (e.key === "." && !String(e.currentTarget.value).includes(".")) return;
  e.preventDefault();
}
