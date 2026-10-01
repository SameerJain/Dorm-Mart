import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const LONG_PRESS_MS = 450;
const MOVE_TOLERANCE_PX = 10;
const MENU_WIDTH = 208;
const MENU_GAP = 6;
const VIEWPORT_MARGIN = 8;

const ICONS = {
  copy: "M8 7V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2M5 8h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2Z",
  edit: "M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5Z",
  download: "M12 3v12m0 0-4-4m4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2",
  report: "M4 21V4m0 0h11l-1.5 4L15 12H4",
  trash: "M4 7h16M10 11v6m4-6v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4h6v3",
  more: "M5 12h.01M12 12h.01M19 12h.01",
};

function ActionIcon({ name, className = "h-4 w-4" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={name === "more" ? 3 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={ICONS[name]} />
    </svg>
  );
}

function prefersHover() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(hover: hover) and (pointer: fine)").matches
  );
}

/**
 * Per-message action menu, modelled on Discord/Slack:
 * - pointer devices: a small toolbar appears on hover/focus with quick actions
 *   and a "More" (⋯) button; right-click opens the same menu.
 * - touch devices: long-press opens a bottom sheet with large tap targets.
 *
 * `actions` items: { key, label, icon, onSelect, danger?, disabled?, quick? }.
 * Danger actions (Report) are listed last, after a divider, in red.
 */
export default function MessageActions({ actions, align = "start", preview, children }) {
  const [menuPos, setMenuPos] = useState(null);
  const menuOpen = menuPos !== null;
  const [sheetOpen, setSheetOpen] = useState(false);
  const wrapperRef = useRef(null);
  const moreRef = useRef(null);
  const menuRef = useRef(null);
  const pressRef = useRef(null);
  // The finger that long-pressed is still down when the sheet appears; lifting it
  // fires a click on whatever is now under it. Ignore clicks until a fresh press
  // starts inside the sheet (keyboard activation, detail === 0, is always allowed).
  const sheetArmedRef = useRef(false);

  const visible = actions.filter(Boolean);
  const regular = visible.filter((a) => !a.danger);
  const danger = visible.filter((a) => a.danger);
  const quick = regular.filter((a) => a.quick);

  const closeAll = useCallback(() => {
    setMenuPos(null);
    setSheetOpen(false);
  }, []);

  // The chat pane clips overflow, so the menu is portalled and fixed-positioned
  // from the More button, clamped inside the viewport, and flipped upward when
  // the message sits too low for it to fit below.
  const openMenu = useCallback(() => {
    const anchor = (moreRef.current?.offsetParent ? moreRef.current : wrapperRef.current)?.getBoundingClientRect();
    if (!anchor) return;
    const vw = window.innerWidth;
    const left = Math.min(
      Math.max(align === "end" ? anchor.left : anchor.right - MENU_WIDTH, VIEWPORT_MARGIN),
      vw - MENU_WIDTH - VIEWPORT_MARGIN,
    );
    const openUp = window.innerHeight - anchor.bottom < 240 && anchor.top > 240;
    setMenuPos(
      openUp
        ? { left, bottom: window.innerHeight - anchor.top + MENU_GAP }
        : { left, top: anchor.bottom + MENU_GAP },
    );
  }, [align]);

  const openForDevice = useCallback(() => {
    if (prefersHover()) openMenu();
    else setSheetOpen(true);
  }, [openMenu]);

  // Close the desktop menu on outside click / Escape; move focus into it on open.
  useEffect(() => {
    if (!menuOpen) return undefined;
    menuRef.current?.querySelector('[role="menuitem"]:not([disabled])')?.focus();
    const onPointerDown = (e) => {
      if (!wrapperRef.current?.contains(e.target) && !menuRef.current?.contains(e.target)) setMenuPos(null);
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        setMenuPos(null);
        moreRef.current?.focus();
      }
    };
    // A fixed menu would detach from its message when the chat scrolls.
    const onScroll = (e) => {
      if (!menuRef.current?.contains(e.target)) setMenuPos(null);
    };
    const onResize = () => setMenuPos(null);
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!sheetOpen) return undefined;
    sheetArmedRef.current = false;
    const onKey = (e) => e.key === "Escape" && setSheetOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [sheetOpen]);

  useEffect(() => () => clearTimeout(pressRef.current?.timer), []);

  if (visible.length === 0) return children;

  function run(action) {
    if (action.disabled) return;
    closeAll();
    action.onSelect();
  }

  function onMenuKeyDown(e) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const items = [...(menuRef.current?.querySelectorAll('[role="menuitem"]:not([disabled])') || [])];
    const i = items.indexOf(document.activeElement);
    const next = e.key === "ArrowDown" ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
    items[next]?.focus();
  }

  // Long-press for touch screens. iOS Safari fires no contextmenu event, so time
  // the press ourselves; a drag (scrolling the chat) cancels it.
  function onTouchStart(e) {
    const t = e.touches[0];
    clearTimeout(pressRef.current?.timer);
    pressRef.current = {
      x: t.clientX,
      y: t.clientY,
      timer: setTimeout(() => {
        navigator.vibrate?.(10);
        setSheetOpen(true);
      }, LONG_PRESS_MS),
    };
  }
  function onTouchMove(e) {
    const p = pressRef.current;
    const t = e.touches[0];
    if (p && Math.hypot(t.clientX - p.x, t.clientY - p.y) > MOVE_TOLERANCE_PX) clearTimeout(p.timer);
  }
  function cancelPress() {
    clearTimeout(pressRef.current?.timer);
  }

  const itemClass = (a) =>
    "flex w-full items-center gap-3 text-left disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none " +
    (a.danger
      ? "text-red-600 hover:bg-red-600 hover:text-white focus-visible:bg-red-600 focus-visible:text-white dark:text-red-400"
      : "text-gray-700 hover:bg-indigo-50 focus-visible:bg-indigo-50 dark:text-gray-200 dark:hover:bg-gray-700 dark:focus-visible:bg-gray-700");

  return (
    <div
      ref={wrapperRef}
      className="group/msg relative max-w-[80%] [-webkit-touch-callout:none] [@media(hover:none)]:select-none"
      onContextMenu={(e) => {
        // Right-click on desktop; long-press on Android also lands here.
        if (e.target.closest("a, video, textarea")) return;
        e.preventDefault();
        openForDevice();
      }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={cancelPress}
      onTouchCancel={cancelPress}
    >
      {children}

      {/* Hover toolbar: only rendered as visible on devices that can hover. */}
      <div
        className={
          "absolute -top-4 z-20 hidden items-center gap-0.5 rounded-lg border border-gray-200 bg-white p-0.5 shadow-md transition-opacity dark:border-gray-600 dark:bg-gray-800 [@media(hover:hover)]:flex " +
          (align === "end" ? "left-0 -translate-x-1/3 " : "right-0 translate-x-1/3 ") +
          (menuOpen
            ? "opacity-100"
            : "pointer-events-none opacity-0 group-hover/msg:pointer-events-auto group-hover/msg:opacity-100 group-focus-within/msg:pointer-events-auto group-focus-within/msg:opacity-100")
        }
      >
        {quick.map((a) => (
          <button
            key={a.key}
            type="button"
            title={a.label}
            aria-label={a.label}
            disabled={a.disabled}
            onClick={() => run(a)}
            className="rounded-md p-1.5 text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white"
          >
            <ActionIcon name={a.icon} />
          </button>
        ))}
        <button
          ref={moreRef}
          type="button"
          title="More"
          aria-label="More message actions"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => (menuOpen ? setMenuPos(null) : openMenu())}
          className={
            "rounded-md p-1.5 text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white " +
            (menuOpen ? "bg-gray-100 dark:bg-gray-700" : "")
          }
        >
          <ActionIcon name="more" />
        </button>
      </div>

      {menuOpen && createPortal(
        <div
          ref={menuRef}
          role="menu"
          aria-label="Message actions"
          onKeyDown={onMenuKeyDown}
          style={{ ...menuPos, width: MENU_WIDTH }}
          className="fixed z-[60] overflow-hidden rounded-lg border border-gray-200 bg-white py-1 text-sm shadow-xl dark:border-gray-600 dark:bg-gray-800"
        >
          {regular.map((a) => (
            <button key={a.key} type="button" role="menuitem" disabled={a.disabled} onClick={() => run(a)} className={itemClass(a) + " px-3 py-2"}>
              <ActionIcon name={a.icon} />
              <span>{a.label}</span>
            </button>
          ))}
          {danger.length > 0 && regular.length > 0 && <div className="my-1 border-t border-gray-200 dark:border-gray-700" role="separator" />}
          {danger.map((a) => (
            <button key={a.key} type="button" role="menuitem" disabled={a.disabled} onClick={() => run(a)} className={itemClass(a) + " px-3 py-2 font-medium"}>
              <ActionIcon name={a.icon} />
              <span>{a.label}</span>
            </button>
          ))}
        </div>,
        document.body,
      )}

      {sheetOpen && createPortal(
        <div
          className="fixed inset-0 z-[60] flex items-end bg-black/40"
          onPointerDownCapture={() => { sheetArmedRef.current = true; }}
          onClickCapture={(e) => {
            if (!sheetArmedRef.current && e.detail !== 0) {
              e.stopPropagation();
              e.preventDefault();
            }
          }}
          onClick={(e) => e.target === e.currentTarget && setSheetOpen(false)}
        >
          <div
            role="menu"
            aria-label="Message actions"
            className="w-full animate-sheet-up rounded-t-2xl bg-white pb-[max(0.75rem,env(safe-area-inset-bottom))] pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)] pt-2 shadow-2xl dark:bg-gray-800"
          >
            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-gray-300 dark:bg-gray-600" aria-hidden="true" />
            {preview && (
              <p className="mx-4 mb-2 line-clamp-2 break-words rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                {preview}
              </p>
            )}
            {regular.map((a) => (
              <button key={a.key} type="button" role="menuitem" disabled={a.disabled} onClick={() => run(a)} className={itemClass(a) + " min-h-[48px] px-5 text-base"}>
                <ActionIcon name={a.icon} className="h-5 w-5" />
                <span>{a.label}</span>
              </button>
            ))}
            {danger.length > 0 && regular.length > 0 && <div className="mx-4 my-1 border-t border-gray-200 dark:border-gray-700" role="separator" />}
            {danger.map((a) => (
              <button key={a.key} type="button" role="menuitem" disabled={a.disabled} onClick={() => run(a)} className={itemClass(a) + " min-h-[48px] px-5 text-base font-medium"}>
                <ActionIcon name={a.icon} className="h-5 w-5" />
                <span>{a.label}</span>
              </button>
            ))}
            <div className="mx-4 mt-2 border-t border-gray-200 pt-2 dark:border-gray-700">
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                className="min-h-[48px] w-full rounded-xl bg-gray-100 text-base font-semibold text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:bg-gray-700 dark:text-gray-100"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
