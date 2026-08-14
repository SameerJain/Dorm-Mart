import { useContext } from "react";
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

export default function NotificationPage() {
  const ctx = useContext(ChatContext);
  const items = Array.isArray(ctx?.unreadNotificationsByProduct)
    ? ctx.unreadNotificationsByProduct
    : [];
  const navigate = useNavigate();

  async function remove(notificationId) {
    try {
      const res = await csrfFetch(`${API_BASE}/wishlist/delete_notification.php`, {
        method: "POST",
        headers: jsonHeaders,
        credentials: "include",
        body: JSON.stringify({ notification_id: notificationId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      ctx?.removeNotificationLocal?.(notificationId);
    } catch (error) {
      logger.error("Failed to delete notification:", error);
      alert("Failed to delete the notification. Please try again.");
    }
  }

  async function clearAll() {
    try {
      const res = await csrfFetch(`${API_BASE}/wishlist/clear_notifications.php`, {
        method: "POST",
        headers: jsonHeaders,
        credentials: "include",
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      ctx?.clearNotificationsLocal?.();
    } catch (error) {
      logger.error("Failed to clear notifications:", error);
      alert("Failed to clear notifications. Please try again.");
    }
  }

  async function openNotification(notification) {
    if (!notification.destination) return;

    if (!notification.is_read) {
      try {
        const res = await csrfFetch(`${API_BASE}/wishlist/mark_item_read.php`, {
          method: "POST",
          headers: jsonHeaders,
          credentials: "include",
          body: JSON.stringify({ notification_id: notification.notification_id }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        ctx?.markNotificationReadLocal?.(notification.notification_id);
      } catch (error) {
        logger.error("Failed to mark notification as read:", error);
      }
    }

    navigate(notification.destination);
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-900">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Notifications
          </h1>
          {items.length > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="rounded-full border px-4 py-2 text-sm text-gray-700 dark:text-gray-200"
            >
              Clear All
            </button>
          )}
        </div>
        {items.length === 0 ? (
          <div className="mt-12 text-center text-gray-600 dark:text-gray-300">
            <div className="mb-3 text-3xl">{"\uD83D\uDD14"}</div>
            <p className="text-lg font-medium">You have no notifications.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((notification) => {
              const image = notification.image_url
                ? resolveProductPhotoUrl(notification.image_url, {
                    apiBase: API_BASE,
                    proxyUnknown: true,
                  })
                : null;
              const clickable = Boolean(notification.destination);
              return (
                <div
                  key={notification.notification_id}
                  className={`flex gap-4 rounded-2xl border p-4 shadow-sm ${tones[notification.severity] || tones.info}`}
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
                    disabled={!clickable}
                    onClick={() => openNotification(notification)}
                    className={`min-w-0 flex-1 text-left ${clickable ? "cursor-pointer" : "cursor-default"}`}
                  >
                    <h2
                      className={`font-semibold text-gray-900 dark:text-gray-100 ${clickable ? "hover:underline" : ""}`}
                    >
                      {notification.title}
                    </h2>
                    <p className="mt-1 text-sm text-gray-700 dark:text-gray-200">
                      {notification.message}
                    </p>
                    <p className="mt-2 text-xs text-gray-500">
                      {new Date(notification.created_at).toLocaleString()}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(notification.notification_id)}
                    className="self-start rounded-full border px-3 py-1.5 text-xs text-gray-700 dark:text-gray-200"
                  >
                    Delete
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
