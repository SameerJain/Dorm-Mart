import { useEffect, useState } from "react";
import { API_BASE } from "../../../utils/apiConfig";
import { apiGetJson } from "../../../utils/apiClient";
import logger from "../../../utils/logger";

/**
 * Seller insights computed server-side (earnings, rating, meetups, time to sell).
 * `refreshKey` changes when the listings change so the numbers stay in step.
 *
 * Returns { stats, status } where status is "loading", "ready" or "error", so
 * the dashboard can say the insights failed instead of silently hiding them.
 */
export function useSellerStats(refreshKey) {
  const [stats, setStats] = useState(null);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    if (refreshKey === null) return undefined;
    const controller = new AbortController();
    apiGetJson(`${API_BASE}/seller_dashboard/seller_stats.php`, { signal: controller.signal })
      .then((result) => {
        if (!result?.success) throw new Error(result?.error || "Unable to load seller stats");
        setStats(result.data);
        setStatus("ready");
      })
      .catch((error) => {
        if (error.name === "AbortError") return;
        logger.error("Error fetching seller stats:", error);
        // Keep the last good numbers if a refresh fails.
        setStatus((current) => (current === "ready" ? current : "error"));
      });
    return () => controller.abort();
  }, [refreshKey]);

  return { stats, status };
}
