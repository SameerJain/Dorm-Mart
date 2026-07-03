import { useEffect, useState } from "react";
import { API_BASE } from "../../../utils/apiConfig";
import { apiGetJson } from "../../../utils/apiClient";
import logger from "../../../utils/logger";

export function useSellerDashboardReviews(listings) {
  const [productReviews, setProductReviews] = useState({});
  const [buyerRatings, setBuyerRatings] = useState({});

  useEffect(() => {
    const controller = new AbortController();
    const fetchReviews = async () => {
      const soldListings = listings.filter(
        (listing) => String(listing.status || "").toLowerCase() === "sold",
      );

      const reviewEntries = await Promise.all(
        soldListings.map(async (listing) => {
          try {
            const result = await apiGetJson(
              `${API_BASE}/reviews/get_product_reviews.php?product_id=${listing.id}`,
              { signal: controller.signal },
            );
            if (result?.success && result.reviews && result.reviews.length > 0) {
              return [listing.id, result.reviews[0]];
            }
          } catch (error) {
            if (error.name !== "AbortError") {
              logger.error(
                `[Review Fetch] Error fetching reviews for product ${listing.id}:`,
                error,
              );
            }
          }
          return null;
        }),
      );

      if (!controller.signal.aborted) {
        setProductReviews(Object.fromEntries(reviewEntries.filter(Boolean)));
      }
    };

    if (listings.length > 0) {
      fetchReviews();
    } else {
      setProductReviews({});
    }
    return () => controller.abort();
  }, [listings]);

  useEffect(() => {
    const controller = new AbortController();
    const fetchBuyerRatings = async () => {
      const soldListings = listings.filter(
        (listing) =>
          String(listing.status || "").toLowerCase() === "sold" &&
          listing.buyer_user_id,
      );

      const ratingEntries = await Promise.all(
        soldListings.map(async (listing) => {
          try {
            const result = await apiGetJson(
              `${API_BASE}/reviews/get_buyer_rating.php?product_id=${listing.id}`,
              { signal: controller.signal },
            );
            if (result?.success && result.has_rating) {
              return [listing.id, result.rating];
            }
          } catch (error) {
            if (error.name !== "AbortError") {
              logger.error(
                `Error fetching buyer rating for product ${listing.id}:`,
                error,
              );
            }
          }
          return null;
        }),
      );

      if (!controller.signal.aborted) {
        setBuyerRatings(Object.fromEntries(ratingEntries.filter(Boolean)));
      }
    };

    if (listings.length > 0) {
      fetchBuyerRatings();
    } else {
      setBuyerRatings({});
    }
    return () => controller.abort();
  }, [listings]);

  const updateBuyerRating = (productId, rating) => {
    setBuyerRatings((prev) => ({
      ...prev,
      [productId]: rating,
    }));
  };

  return { productReviews, buyerRatings, updateBuyerRating };
}
