// src/pages/NotificationPage.jsx
import React, { useContext, useMemo, useState, useEffect } from "react";
import { ChatContext } from "../../context/ChatContext";

const BASE = process.env.REACT_APP_API_BASE || "api";

export default function NotificationPage() {
  const ctx = useContext(ChatContext);
  const {
    unreadNotificationsByProduct,
    markAllNotificationsReadLocal,
    markNotificationReadLocal,
  } = ctx || {};

  // Normalize object -> array for rendering
  const items = useMemo(() => {
    if (!unreadNotificationsByProduct) return [];
    return Object.entries(unreadNotificationsByProduct)
      .map(([productId, info]) => {
        const count = Number(info?.count ?? 0);
        const title = info?.title ?? `Listing #${productId}`;
        const imageUrl = info?.image_url ?? null;
        return {
          productId: Number(productId),
          title,
          count,
          imageUrl,
        };
      })
      .filter((item) => item.count > 0);
  }, [unreadNotificationsByProduct]);

  const [localItems, setLocalItems] = useState([]);

  useEffect(() => {
    setLocalItems(items);
  }, [items]);

  const hasAny = localItems.length > 0;

  async function handleMarkAllRead() {
    try {
      const res = await fetch(`${BASE}/wishlist/mark_all_items_read.php`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "include",
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      // Optimistic local UI update
      setLocalItems([]);

      // Also clear the global notification total + map so nav badge updates immediately
      if (typeof markAllNotificationsReadLocal === "function") {
        markAllNotificationsReadLocal();
      }
    } catch (e) {
      console.error("Failed to mark all notifications as read:", e);
      alert("Failed to mark all as read. Please try again.");
    }
  }

  async function handleMarkRead(productId) {
    try {
      const res = await fetch(`${BASE}/wishlist/mark_item_read.php`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ product_id: productId }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      // Optimistic local UI update
      setLocalItems((prev) =>
        prev.filter((item) => item.productId !== productId)
      );

      // Decrement the global total + remove from map so nav badge updates
      if (typeof markNotificationReadLocal === "function") {
        markNotificationReadLocal(productId);
      }
    } catch (e) {
      console.error("Failed to mark notification as read:", e);
      alert("Failed to mark as read. Please try again.");
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
            Notifications
          </h1>

          {hasAny && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="text-xs sm:text-sm px-3 py-1.5 rounded-full border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              Mark all as read
            </button>
          )}
        </div>

        {/* List */}
        {!hasAny ? (
          <div className="mt-8 text-center text-gray-500 dark:text-gray-400">
            <p className="text-lg">No new wishlist notifications.</p>
            <p className="text-sm mt-1">
              When buyers add your listings to their wishlist, they’ll appear
              here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {localItems.map(({ productId, title, count, imageUrl }) => (
              <div
                key={productId}
                className="flex items-start gap-3 rounded-xl border p-4 bg-white dark:bg-gray-800 dark:border-gray-700"
              >
                <div className="pt-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-blue-600" />
                </div>

                <div className="flex-1 flex gap-3">
                  {imageUrl && (
                    <div className="flex-shrink-0 w-12 h-12 rounded-md overflow-hidden bg-gray-100 dark:bg-gray-700">
                      <img
                        src={imageUrl}
                        alt={title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  <div>
                    <h2 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100">
                      {title}
                    </h2>

                    <p className="mt-1 text-sm text-gray-700 dark:text-gray-200">
                      This listing has{" "}
                      <span className="font-semibold">
                        {count} new wishlist {count === 1 ? "save" : "saves"}
                      </span>
                      .
                    </p>
                  </div>
                </div>

                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => handleMarkRead(productId)}
                    className="text-xs sm:text-sm px-3 py-1.5 rounded-full border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    Mark read
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
