import { useEffect, useState } from "react";
import { API_BASE, PUBLIC_BASE } from "../../../utils/apiConfig";
import { apiPostJson } from "../../../utils/apiClient";
import logger from "../../../utils/logger";
import { normalizeSearchResults } from "../utils/searchResultsUtils";

export function useSearchResults(payload) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadResults() {
      setLoading(true);
      setError(null);
      try {
        const data = await apiPostJson(
          `${API_BASE}/search/get_search_items.php`,
          payload,
          { signal: controller.signal },
        );
        if (!controller.signal.aborted) {
          setItems(
            normalizeSearchResults(data, {
              apiBase: API_BASE,
              publicBase: PUBLIC_BASE,
            }),
          );
        }
      } catch (requestError) {
        if (requestError.name !== "AbortError") {
          logger.error("get_search_items failed:", requestError);
          setError(requestError);
          setItems([]);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    loadResults();
    return () => controller.abort();
  }, [payload]);

  return { items, loading, error };
}
