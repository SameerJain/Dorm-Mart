import { useEffect, useState } from "react";
import { API_BASE } from "../../../utils/apiConfig";
import { apiGetJson } from "../../../utils/apiClient";
import logger from "../../../utils/logger";

export function useSellerDashboardReviews(listings) {
  const [productReviews, setProductReviews] = useState({});
  const [buyerRatings, setBuyerRatings] = useState({});

  useEffect(() => {
    const fetchReviews = async () => {
      const soldListings = listings.filter(
        (listing) => String(listing.status || "").toLowerCase() === "sold",
      );
      const reviewMap = {};

      for (const listing of soldListings) {
        try {
          const result = await apiGetJson(
            `${API_BASE}/reviews/get_product_reviews.php?product_id=${listing.id}`,
          );
          if (result.success && result.reviews && result.reviews.length > 0) {
            reviewMap[listing.id] = result.reviews[0];
          }
        } catch (error) {
          logger.error(
            `[Review Fetch] Error fetching reviews for product ${listing.id}:`,
            error,
          );
        }
      }

      setProductReviews(reviewMap);
    };

    if (listings.length > 0) {
      fetchReviews();
    } else {
      setProductReviews({});
    }
  }, [listings]);

  useEffect(() => {
    const fetchBuyerRatings = async () => {
      const soldListings = listings.filter(
        (listing) =>
          String(listing.status || "").toLowerCase() === "sold" &&
          listing.buyer_user_id,
      );
      const ratingMap = {};

      for (const listing of soldListings) {
        try {
          const result = await apiGetJson(
            `${API_BASE}/reviews/get_buyer_rating.php?product_id=${listing.id}`,
          );
          if (result.success && result.has_rating) {
            ratingMap[listing.id] = result.rating;
          }
        } catch (error) {
          logger.error(
            `Error fetching buyer rating for product ${listing.id}:`,
            error,
          );
        }
      }

      setBuyerRatings(ratingMap);
    };

    if (listings.length > 0) {
      fetchBuyerRatings();
    } else {
      setBuyerRatings({});
    }
  }, [listings]);

  const updateBuyerRating = (productId, rating) => {
    setBuyerRatings((prev) => ({
      ...prev,
      [productId]: rating,
    }));
  };

  return { productReviews, buyerRatings, updateBuyerRating };
}
