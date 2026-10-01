import { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChatContext } from "../../context/ChatContext";
import { onProductImageError, resolveProductPhotoUrl } from "../../utils/imageFallback";
import { API_BASE } from "../../utils/apiConfig";
import { csrfFetch } from "../../utils/csrfFetch";
import logger from "../../utils/logger";

const tones = {
  success: "border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950/30",
  warning: "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30",
  urgent: "border-red-400 bg-red-50 dark:border-red-800 dark:bg-red-950/40",
  info: "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800",
};

const jsonHeaders = {
  "Content-Type": "application/json",
  Accept: "application/json",
};

export function isSafeNotificationDestination(value) {
  return typeof value === "string" && /^\/app(?:[/?]|$)/.test(value);
}

/**
 * Notification times arrive as ISO UTC strings. Older payloads used a bare
 * "YYYY-MM-DD HH:MM:SS" (also UTC), which browsers read as local time; treat
 * that shape as UTC too so times are never shifted by the viewer's offset.
 */
export function formatNotificationTime(value) {
  if (typeof value !== "string" || value.trim() === "") return "";
  const text = value.trim();
  const iso = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(text)
    ? `${text.replace(" ", "T")}Z`
    : text;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
}

async function postNotificationAction(endpoint, body) {
  const res = await csrfFetch(`${API_BASE}/wishlist/${endpoint}`, {
    method: "POST",
    headers: jsonHeaders,
    credentials: "include",
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res;
}

export default function NotificationPage() {
  const ctx = useContext(ChatContext);
  const items = Array.isArray(ctx?.unreadNotificationsByProduct)
    ? ctx.unreadNotificationsByProduct
    : [];
  // Older providers (and tests) don't expose a status; treat them as loaded.
  const status = ctx?.notificationsStatus ?? "ready";
  const refreshNotifications = ctx?.refreshNotifications;
  const navigate = useNavigate();
  const [actionError, setActionError] = useState("");
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [busy, setBusy] = useState(false);
  const unreadCount = items.filter((item) => !item.is_read).length;

  // Load immediately instead of waiting for the next background poll.
  useEffect(() => {
    if (typeof refreshNotifications === "function") refreshNotifications();
  }, [refreshNotifications]);

  async function remove(notificationId) {
    setActionError("");
    try {
      await postNotificationAction("delete_notification.php", { notification_id: notificationId });
      ctx?.removeNotificationLocal?.(notificationId);
    } catch (error) {
      logger.error("Failed to delete notification:", error);
      setActionError("Couldn't delete that notification. Please try again.");
    }
  }

  async function clearAll() {
    setActionError("");
    setBusy(true);
    try {
      await postNotificationAction("clear_notifications.php", {});
      ctx?.clearNotificationsLocal?.();
      setConfirmingClear(false);
    } catch (error) {
      logger.error("Failed to clear notifications:", error);
      setActionError("Couldn't clear your notifications. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function markAllRead() {
    setActionError("");
    setBusy(true);
    try {
      await postNotificationAction("mark_all_items_read.php", {});
      ctx?.markAllNotificationsReadLocal?.();
    } catch (error) {
      logger.error("Failed to mark notifications as read:", error);
      setActionError("Couldn't mark your notifications as read. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function markRead(notification) {
    if (notification.is_read) return;
    try {
      await postNotificationAction("mark_item_read.php", {
        notification_id: notification.notification_id,
      });
      ctx?.markNotificationReadLocal?.(notification.notification_id);
    } catch (error) {
      logger.error("Failed to mark notification as read:", error);
    }
  }

  // Every notification can be opened: ones with a link navigate there, the rest
  // (sold, removed, report outcomes) are simply marked read so they stop
  // counting toward the badge.
  async function openNotification(notification) {
    await markRead(notification);
    if (isSafeNotificationDestination(notification.destination)) {
      navigate(notification.destination);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-900">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Notifications
          </h1>
          {items.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  disabled={busy}
                  className="rounded-full border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  Mark all read
                </button>
              )}
              {confirmingClear ? (
                <>
                  <span className="text-sm text-gray-700 dark:text-gray-200">
                    Delete all notifications?
                  </span>
                  <button
                    type="button"
                    onClick={clearAll}
                    disabled={busy}
                    className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    Delete all
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingClear(false)}
                    disabled={busy}
                    className="rounded-full border border-gray-300 px-4 py-2 text-sm text-gray-700 dark:border-gray-600 dark:text-gray-200"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingClear(true)}
                  className="rounded-full border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  Clear All
                </button>
              )}
            </div>
          )}
        </div>

        {actionError && (
          <p
            role="alert"
            className="mb-4 rounded-lg bg-red-100 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200"
          >
            {actionError}
          </p>
        )}

        {status === "loading" && items.length === 0 ? (
          <p
            aria-live="polite"
            className="mt-12 text-center text-gray-600 dark:text-gray-300"
          >
            Loading notifications…
          </p>
        ) : status === "error" && items.length === 0 ? (
          <div
            role="alert"
            className="mt-12 text-center text-gray-700 dark:text-gray-200"
          >
            <p className="text-lg font-medium">Couldn't load your notifications.</p>
            {typeof refreshNotifications === "function" && (
              <button
                type="button"
                onClick={() => refreshNotifications()}
                className="mt-3 rounded-full border border-gray-300 px-4 py-2 text-sm dark:border-gray-600"
              >
                Try again
              </button>
            )}
          </div>
        ) : items.length === 0 ? (
          <div className="mt-12 text-center text-gray-600 dark:text-gray-300">
            <div className="mb-3 text-3xl" aria-hidden="true">{"🔔"}</div>
            <p className="text-lg font-medium">You have no notifications.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map((notification) => {
              const image = notification.image_url
                ? resolveProductPhotoUrl(notification.image_url, {
                    apiBase: API_BASE,
                    proxyUnknown: true,
                  })
                : null;
              const hasLink = isSafeNotificationDestination(notification.destination);
              const unread = !notification.is_read;
              const time = formatNotificationTime(notification.created_at);
              return (
                <li
                  key={notification.notification_id}
                  className={`flex gap-4 rounded-2xl border p-4 shadow-sm ${tones[notification.severity] || tones.info} ${unread ? "" : "opacity-75"}`}
                >
                  {image && (
                    <img
                      src={image}
                      alt=""
                      onError={onProductImageError}
                      className="h-16 w-16 flex-none rounded-lg object-cover"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => openNotification(notification)}
                    disabled={!hasLink && !unread}
                    className={`min-w-0 flex-1 text-left ${hasLink || unread ? "cursor-pointer" : "cursor-default"}`}
                  >
                    <h2
                      className={`flex items-center gap-2 text-gray-900 dark:text-gray-100 ${unread ? "font-bold" : "font-semibold"} ${hasLink ? "hover:underline" : ""}`}
                    >
                      {unread && (
                        <span
                          className="inline-block h-2 w-2 flex-none rounded-full bg-blue-600 dark:bg-blue-400"
                          aria-hidden="true"
                        />
                      )}
                      <span>{notification.title}</span>
                      {unread && <span className="sr-only">(unread)</span>}
                    </h2>
                    <p className="mt-1 text-sm text-gray-700 dark:text-gray-200">
                      {notification.message}
                    </p>
                    {notification.listing_unavailable && (
                      <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                        This listing is no longer available.
                      </p>
                    )}
                    {time && (
                      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{time}</p>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(notification.notification_id)}
                    aria-label={`Delete notification: ${notification.title}`}
                    className="self-start rounded-full border border-gray-300 px-3 py-1.5 coarse:py-2 text-xs text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                  >
                    Delete
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
