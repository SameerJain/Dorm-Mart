import { useCallback, useEffect, useState } from "react";
import { API_BASE } from "../../../utils/apiConfig";
import logger from "../../../utils/logger";

const DONE_STYLES = {
  container:
    "max-w-[85%] rounded-2xl border-2 border-gray-400 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 text-gray-600 dark:text-gray-300 overflow-hidden",
  icon: "w-5 h-5 text-gray-600 dark:text-gray-400 flex-shrink-0 mt-0.5",
  title: "text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1",
  text: "text-sm text-gray-600 dark:text-gray-400 mb-3",
  button:
    "px-4 py-2 bg-gray-500 hover:bg-gray-600 dark:bg-gray-600 dark:hover:bg-gray-500 text-white text-sm font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400",
};

const PENDING_STYLES = {
  container:
    "max-w-[85%] rounded-2xl border-2 border-orange-400 dark:border-orange-600 bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-300 overflow-hidden",
  icon: "w-5 h-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5",
  title: "text-sm font-semibold text-orange-800 dark:text-orange-200 mb-1",
  text: "text-sm text-orange-700 dark:text-orange-300 mb-3",
  button:
    "px-4 py-2 bg-orange-600 hover:bg-orange-700 dark:bg-orange-700 dark:hover:bg-orange-600 text-white text-sm font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-orange-400",
};

const ICON_PATHS = {
  check: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
  star: "M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z",
  info: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
};

/** Shared fetch-on-mount + refetch-on-tab-focus status hook. */
export function usePromptStatus({ productId, statusUrl, resultKey, logLabel }) {
  const [isDone, setIsDone] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!productId) return;
    try {
      const response = await fetch(`${API_BASE}${statusUrl}?product_id=${productId}`, {
        method: "GET",
        credentials: "include",
      });
      if (response.ok) {
        const result = await response.json();
        setIsDone(!!(result.success && result[resultKey]));
      }
    } catch (error) {
      logger.error(logLabel, error);
    } finally {
      setIsLoading(false);
    }
  }, [productId, statusUrl, resultKey, logLabel]);

  useEffect(() => {
    if (!productId) {
      setIsLoading(false);
      return;
    }
    refetch();
  }, [productId, refetch]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && productId) refetch();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [productId, refetch]);

  return { isDone, isLoading };
}

/** Shared orange-pending / gray-done prompt card. */
export default function StatusPromptMessageCard({
  isDone,
  pendingIcon = "star",
  pendingTitle,
  doneTitle,
  pendingText,
  doneText,
  pendingButtonLabel,
  doneButtonLabel,
  onAction,
}) {
  const styles = isDone ? DONE_STYLES : PENDING_STYLES;
  const iconPath = isDone ? ICON_PATHS.check : ICON_PATHS[pendingIcon];

  return (
    <div className="flex justify-center my-2">
      <div className={styles.container}>
        <div className="p-4">
          <div className="flex items-start gap-2 min-w-0">
            <svg
              className={styles.icon}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d={iconPath}
              />
            </svg>
            <div className="flex-1 min-w-0 max-w-full overflow-hidden">
              <p className={styles.title}>{isDone ? doneTitle : pendingTitle}</p>
              <p className={`${styles.text} break-words`}>
                {isDone ? doneText : pendingText}
              </p>
              <button onClick={onAction} className={styles.button}>
                {isDone ? doneButtonLabel : pendingButtonLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
