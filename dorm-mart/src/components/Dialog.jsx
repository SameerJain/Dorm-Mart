import { useEffect, useId, useRef } from "react";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessible modal shell: role="dialog" with a labelled title, Escape and
 * backdrop click to close, focus moved in on open, kept inside while open, and
 * returned to the opener on close. Page scroll is locked while it is open.
 *
 * `dismissible={false}` (e.g. while a request is in flight) disables Escape
 * and backdrop close without unmounting the dialog.
 */
export default function Dialog({
  title,
  description,
  onClose,
  dismissible = true,
  children,
  className = "",
  initialFocusRef,
}) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const dismissibleRef = useRef(dismissible);
  dismissibleRef.current = dismissible;

  useBodyScrollLock(true);

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const panel = panelRef.current;
    const first =
      initialFocusRef?.current || panel?.querySelector(FOCUSABLE) || panel;
    first?.focus?.();

    function onKeyDown(event) {
      if (event.key === "Escape" && dismissibleRef.current) {
        event.stopPropagation();
        onCloseRef.current?.();
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
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={() => dismissibleRef.current && onCloseRef.current?.()}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={`max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-lg bg-white shadow-xl outline-none dark:bg-gray-800 ${className}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="p-6">
          <h2
            id={titleId}
            className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100"
          >
            {title}
          </h2>
          {description && (
            <div
              id={descriptionId}
              className="mb-4 space-y-2 text-sm text-gray-700 dark:text-gray-300"
            >
              {description}
            </div>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}

/**
 * Confirm/cancel dialog on top of Dialog. While `busy`, both buttons are
 * disabled and the dialog cannot be dismissed.
 */
export function ConfirmDialog({
  title,
  description,
  error,
  busy = false,
  confirmLabel = "Confirm",
  busyLabel = "Working…",
  cancelLabel = "Cancel",
  tone = "danger",
  onConfirm,
  onCancel,
  children,
}) {
  const cancelRef = useRef(null);
  const confirmClass =
    tone === "danger"
      ? "bg-red-600 hover:bg-red-700 focus-visible:ring-red-500"
      : "bg-blue-600 hover:bg-blue-700 focus-visible:ring-blue-500";

  return (
    <Dialog
      title={title}
      description={description}
      onClose={onCancel}
      dismissible={!busy}
      initialFocusRef={cancelRef}
    >
      {children}
      {error && (
        <p role="alert" className="mb-4 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-3">
        <button
          ref={cancelRef}
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className={`rounded-lg px-4 py-2 text-sm font-medium text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 dark:focus-visible:ring-offset-gray-800 ${confirmClass}`}
        >
          {busy ? busyLabel : confirmLabel}
        </button>
      </div>
    </Dialog>
  );
}
