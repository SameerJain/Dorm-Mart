import { API_BASE } from "../../../utils/apiConfig";
import { dateTimestamp } from "../../../utils/formatters";
import { resolveProductPhotoUrl } from "../../../utils/imageFallback";

export const EMPTY_SUMMARY_METRICS = {
  totalPosts: 0,
  activeListings: 0,
  pendingSales: 0,
  itemsSold: 0,
  totalViews: 0,
  totalWishlists: 0,
};

function nonNegativeCount(value) {
  const count = Number(value);
  return Number.isFinite(count) && count >= 0 ? Math.floor(count) : 0;
}

export function truncateProductTitle(title, maxLength = 50) {
  if (!title || title.length <= maxLength) return title;
  return `${title.substring(0, maxLength)}...`;
}

export function normalizeSellerListing(item) {
  const rawImg = item.image_url || item.image || null;
  const image =
    resolveProductPhotoUrl(rawImg, {
      apiBase: API_BASE,
      proxyUnknown: true,
    }) || null;

  return {
    id: item.id,
    title: item.title,
    price: item.price || 0,
    status: item.status || "Active",
    createdAt: item.created_at,
    image,
    sold_by: item.sold_by,
    seller_user_id: item.seller_user_id,
    buyer_user_id: item.buyer_user_id,
    wishlisted: nonNegativeCount(item.wishlisted),
    views: nonNegativeCount(item.views),
    categories: Array.isArray(item.categories) ? item.categories : [],
    has_accepted_scheduled_purchase:
      item.has_accepted_scheduled_purchase === true ||
      item.has_accepted_scheduled_purchase === 1,
  };
}

export function calculateSummaryMetrics(listings) {
  return listings.reduce(
    (metrics, listing) => {
      const status = String(listing.status || "").toLowerCase();
      if (status === "active") metrics.activeListings += 1;
      if (status === "pending") metrics.pendingSales += 1;
      if (status === "sold") metrics.itemsSold += 1;
      if (["active", "pending", "sold"].includes(status)) {
        metrics.totalPosts += 1;
        metrics.totalViews += nonNegativeCount(listing.views);
        metrics.totalWishlists += nonNegativeCount(listing.wishlisted);
      }
      return metrics;
    },
    { ...EMPTY_SUMMARY_METRICS },
  );
}

export function filterListings(listings, statusFilter, categoryFilter) {
  return listings.filter((listing) => {
    const status = String(listing.status || "").toLowerCase();
    const okStatus =
      statusFilter === "All Status"
        ? true
        : status === String(statusFilter || "").toLowerCase();
    const categories = Array.isArray(listing.categories)
      ? listing.categories
      : [];
    const okCategory =
      categoryFilter === "All Categories"
        ? true
        : categories.includes(categoryFilter);
    return okStatus && okCategory;
  });
}

export function sortListings(listings, sort, productReviews = {}) {
  const sorted = [...listings];
  switch (sort) {
    case "Newest First":
      return sorted.sort((a, b) => dateTimestamp(b.createdAt, 0) - dateTimestamp(a.createdAt, 0));
    case "Oldest First":
      return sorted.sort((a, b) => dateTimestamp(a.createdAt, 0) - dateTimestamp(b.createdAt, 0));
    case "Price: Low to High":
      return sorted.sort((a, b) => a.price - b.price);
    case "Price: High to Low":
      return sorted.sort((a, b) => b.price - a.price);
    case "Reviewed Items On Top":
      return sorted.sort((a, b) => {
        const aHasReview = productReviews[a.id] ? 1 : 0;
        const bHasReview = productReviews[b.id] ? 1 : 0;
        if (aHasReview !== bHasReview) return bHasReview - aHasReview;
        return dateTimestamp(b.createdAt, 0) - dateTimestamp(a.createdAt, 0);
      });
    case "Reviewed Items On Bottom":
      return sorted.sort((a, b) => {
        const aHasReview = productReviews[a.id] ? 1 : 0;
        const bHasReview = productReviews[b.id] ? 1 : 0;
        if (aHasReview !== bHasReview) return aHasReview - bHasReview;
        return dateTimestamp(b.createdAt, 0) - dateTimestamp(a.createdAt, 0);
      });
    default:
      return sorted;
  }
}

export function readRatingValue(rating) {
  const rawValue =
    rating && typeof rating === "object" ? rating.rating : rating;
  const value = Number(rawValue);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function listingStatusClass(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "active") return "bg-green-100 text-green-800";
  if (normalized === "pending") return "bg-orange-100 text-orange-800";
  if (normalized === "draft") return "bg-yellow-100 text-yellow-800";
  if (normalized === "sold") return "bg-blue-100 text-blue-800";
  return "bg-gray-100 text-gray-800";
}
