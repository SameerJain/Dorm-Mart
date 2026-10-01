import { useEffect, useState } from "react";
import { API_BASE } from "../../../utils/apiConfig";
import { apiGetJson, csrfPostJson } from "../../../utils/apiClient";
import logger from "../../../utils/logger";
import { useSubmitLock } from "../../../hooks/useSubmitLock";

export default function useWishlistStatus({
  productId,
  myId,
  disabled = false,
}) {
  const [isInWishlist, setIsInWishlist] = useState(false);
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const [wishlistError, setWishlistError] = useState(null);
  const runExclusive = useSubmitLock();

  useEffect(() => {
    if (!productId || !myId) {
      setIsInWishlist(false);
      return;
    }

    const controller = new AbortController();
    (async () => {
      try {
        const json = await apiGetJson(
          `${API_BASE}/wishlist/check_wishlist_status.php?product_id=${encodeURIComponent(productId)}`,
          { signal: controller.signal },
        );
        if (json?.success) {
          setIsInWishlist(json.in_wishlist || false);
        }
      } catch (error) {
        if (error.name !== "AbortError") {
          logger.error("check_wishlist_status failed:", error);
        }
      }
    })();

    return () => controller.abort();
  }, [productId, myId]);

  const toggleWishlist = async () => {
    if (wishlistLoading || !productId || !myId || disabled) return;

    setWishlistError(null);
    setWishlistLoading(true);

    try {
      const endpoint = isInWishlist
        ? `${API_BASE}/wishlist/remove_from_wishlist.php`
        : `${API_BASE}/wishlist/add_to_wishlist.php`;

      const json = await csrfPostJson(endpoint, { product_id: Number(productId) });
      if (json?.success) {
        setIsInWishlist(!isInWishlist);
      } else {
        throw new Error(json.error || "Failed to update wishlist");
      }
    } catch (error) {
      logger.error("Wishlist toggle failed:", error);
      setWishlistError(error?.message || "Failed to update wishlist");
    } finally {
      setWishlistLoading(false);
    }
  };

  return {
    isInWishlist,
    wishlistLoading,
    wishlistError,
    handleWishlistToggle: () => runExclusive(toggleWishlist),
  };
}
