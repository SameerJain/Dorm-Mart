import { useCallback, useEffect, useMemo, useState } from "react";
import { API_BASE } from "../../../utils/apiConfig";
import { csrfPostJson } from "../../../utils/apiClient";
import logger from "../../../utils/logger";
import {
  EMPTY_SUMMARY_METRICS,
  calculateSummaryMetrics,
  normalizeSellerListing,
} from "../utils/sellerDashboardUtils";

export function useSellerListings() {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(false);

  const summaryMetrics = useMemo(
    () => calculateSummaryMetrics(listings),
    [listings],
  );

  const fetchListings = useCallback(async () => {
    setLoading(true);
    try {
      const result = await csrfPostJson(
        `${API_BASE}/seller_dashboard/manage_seller_listings.php`,
        {},
      );

      if (result?.success) {
        const dataArray = Array.isArray(result.data) ? result.data : [];
        setListings(dataArray.map(normalizeSellerListing));
      } else {
        logger.error("Unexpected API response format:", result);
        setListings([]);
      }
    } catch (error) {
      logger.error("Error fetching listings:", error);
      setListings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  const deleteListing = useCallback(
    async (id) => {
      const result = await csrfPostJson(
        `${API_BASE}/seller_dashboard/delete_listing.php`,
        { id },
      );
      if (!result?.success) {
        throw new Error(result?.error || "Delete failed");
      }
      setListings((prev) => prev.filter((listing) => listing.id !== id));
    },
    [],
  );

  return {
    listings,
    loading,
    summaryMetrics: summaryMetrics || EMPTY_SUMMARY_METRICS,
    deleteListing,
  };
}
