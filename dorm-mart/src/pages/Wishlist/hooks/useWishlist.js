import { useCallback, useEffect, useState } from "react";
import { apiGetJson, csrfPostJson } from "../../../utils/apiClient";
import { API_BASE, PUBLIC_BASE } from "../../../utils/apiConfig";
import logger from "../../../utils/logger";
import { normalizeWishlistItems } from "../utils/wishlistUtils";

export function useWishlist() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadWishlist() {
      setLoading(true);
      setError(null);
      try {
        const data = await apiGetJson(`${API_BASE}/wishlist/get_wishlist.php`, {
          signal: controller.signal,
        });
        if (!controller.signal.aborted) {
          setItems(
            normalizeWishlistItems(data, {
              apiBase: API_BASE,
              publicBase: PUBLIC_BASE,
            }),
          );
        }
      } catch (requestError) {
        if (requestError.name !== "AbortError") {
          logger.error("get_wishlist failed:", requestError);
          setError(requestError?.message || "Failed to load wishlist");
          setItems([]);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    loadWishlist();
    return () => controller.abort();
  }, []);

  const removeItem = useCallback(async (itemId) => {
    setRemoving(true);
    try {
      const data = await csrfPostJson(
        `${API_BASE}/wishlist/remove_from_wishlist.php`,
        { product_id: Number(itemId) },
      );
      if (!data?.success) {
        throw new Error(data?.error || "Failed to remove from wishlist");
      }
      setItems((current) => current.filter((item) => item.id !== itemId));
      return true;
    } catch (requestError) {
      logger.error("Remove from wishlist failed:", requestError);
      setError(requestError?.message || "Failed to remove from wishlist");
      return false;
    } finally {
      setRemoving(false);
    }
  }, []);

  return { items, loading, removing, error, removeItem };
}
