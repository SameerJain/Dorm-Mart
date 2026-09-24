import { useEffect, useState } from "react";
import { API_BASE } from "../../../utils/apiConfig";
import { apiGetJson } from "../../../utils/apiClient";
import logger from "../../../utils/logger";

/**
 * Seller insights computed server-side (earnings, rating, meetups, time to sell).
 * `refreshKey` changes when the listings change so the numbers stay in step.
 */
export function useSellerStats(refreshKey) {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (refreshKey === null) return undefined;
    const controller = new AbortController();
    apiGetJson(`${API_BASE}/seller_dashboard/seller_stats.php`, { signal: controller.signal })
      .then((result) => {
        if (result?.success) setStats(result.data);
      })
      .catch((error) => {
        if (error.name !== "AbortError") logger.error("Error fetching seller stats:", error);
      });
    return () => controller.abort();
  }, [refreshKey]);

  return stats;
}
