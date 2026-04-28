import { useEffect, useState } from "react";
import { API_BASE } from "../../../utils/apiConfig";

export default function useWishlistStatus({
  productId,
  myId,
  disabled = false,
}) {
  const [isInWishlist, setIsInWishlist] = useState(false);
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const [wishlistError, setWishlistError] = useState(null);

  useEffect(() => {
    if (!productId || !myId) {
      setIsInWishlist(false);
      return;
    }

    const controller = new AbortController();
    (async () => {
      try {
        const response = await fetch(
          `${API_BASE}/wishlist/check_wishlist_status.php?product_id=${encodeURIComponent(productId)}`,
          {
            signal: controller.signal,
            credentials: "include",
          },
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const json = await response.json();
        if (json.success) {
          setIsInWishlist(json.in_wishlist || false);
        }
      } catch (error) {
        if (error.name !== "AbortError") {
          console.error("check_wishlist_status failed:", error);
        }
      }
    })();

    return () => controller.abort();
  }, [productId, myId]);

  const handleWishlistToggle = async () => {
    if (wishlistLoading || !productId || !myId || disabled) return;

    setWishlistError(null);
    setWishlistLoading(true);

    try {
      const endpoint = isInWishlist
        ? `${API_BASE}/wishlist/remove_from_wishlist.php`
        : `${API_BASE}/wishlist/add_to_wishlist.php`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          product_id: Number(productId),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const json = await response.json();
      if (json.success) {
        setIsInWishlist(!isInWishlist);
      } else {
        throw new Error(json.error || "Failed to update wishlist");
      }
    } catch (error) {
      console.error("Wishlist toggle failed:", error);
      setWishlistError(error?.message || "Failed to update wishlist");
    } finally {
      setWishlistLoading(false);
    }
  };

  return {
    isInWishlist,
    wishlistLoading,
    wishlistError,
    handleWishlistToggle,
  };
}
