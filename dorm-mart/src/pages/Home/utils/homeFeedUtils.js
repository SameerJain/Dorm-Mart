import { API_BASE, PUBLIC_BASE } from "../../../utils/apiConfig";
import { coerceNumber, dateTimestamp, parseListField } from "../../../utils/formatters";
import {
  resolveProductPhotoUrl,
  withFallbackImage,
} from "../../../utils/imageFallback";

export const MIN_EXPLORE_ITEMS = 30;
export const HOME_FEED_TAB_SESSION_KEY = "dm_home_feed_tab";

export function readStoredFeedTab() {
  try {
    const value = sessionStorage.getItem(HOME_FEED_TAB_SESSION_KEY);
    if (value === "forYou" || value === "explore") return value;
  } catch {
    /* ignore */
  }
  return null;
}

export function writeStoredFeedTab(tab) {
  try {
    if (tab === "forYou" || tab === "explore") {
      sessionStorage.setItem(HOME_FEED_TAB_SESSION_KEY, tab);
    }
  } catch {
    /* ignore */
  }
}

export function computeExploreLimit() {
  if (typeof window === "undefined") return MIN_EXPLORE_ITEMS;
  const width = window.innerWidth;
  if (width >= 1536) return 42;
  if (width >= 1280) return 36;
  if (width >= 1024) return 32;
  return MIN_EXPLORE_ITEMS;
}

export function shuffleArray(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function deriveSellerUsername(sellerUsername, sellerEmail) {
  if (sellerUsername) return sellerUsername;
  if (!sellerEmail) return null;
  const localPart = String(sellerEmail).split("@")[0]?.trim();
  return localPart || null;
}

export function normalizeLandingItem(data, index = 0) {
  const price = coerceNumber(data.price) ?? 0;
  const rawImg = data.image || data.image_url || null;
  const img = rawImg
    ? resolveProductPhotoUrl(rawImg, {
        apiBase: API_BASE,
        publicBase: PUBLIC_BASE,
        proxyUnknown: true,
      })
    : null;
  const createdAtTs = dateTimestamp(data.created_at, 0);
  const hours = createdAtTs ? (Date.now() - createdAtTs) / 36e5 : null;
  const tags = parseListField(data.tags);
  const category = data.category || (tags.length ? tags[0] : "General");
  const sellerEmail = data.email || data.seller_email || null;

  return {
    id: data.id ?? index,
    title: data.title ?? "Untitled",
    price,
    img: withFallbackImage(img),
    tags,
    status: data.status || (hours != null && hours < 48 ? "JUST POSTED" : "AVAILABLE"),
    category,
    createdAtTs,
    seller: data.seller || data.sold_by || data.seller_name || "Unknown Seller",
    sellerUsername: deriveSellerUsername(data.seller_username, sellerEmail),
    sellerEmail,
    rating: typeof data.rating === "number" ? data.rating : 4.7,
    location: data.location || data.campus || "North Campus",
    recommendationScore: coerceNumber(data.recommendation_score) ?? 0,
    recommendationReason: data.recommendation_reason || null,
    personalized: data.personalized === true || data.personalized === 1,
  };
}

export function getQuickFilterCategories(allCategories, allItems) {
  if (allCategories.length) return allCategories;
  const derived = Array.from(
    new Set(
      allItems
        .flatMap((item) => [
          item.category,
          ...(Array.isArray(item.tags) ? item.tags : []),
        ])
        .filter(Boolean)
        .map((category) => String(category)),
    ),
  );
  return derived.length
    ? derived
    : ["Electronics", "Kitchen", "Furniture", "Dorm Essentials"];
}

/**
 * Build the two home feeds from the landing listings.
 *
 * - forYouItems: ranked by the server's recommendation score, newest first on ties.
 * - exploreItems: a random mix of every listing. Pass `exploreOrder` (a shuffled
 *   copy made once per load) so resizing the window, which changes
 *   `exploreLimit`, does not reshuffle what the user is looking at.
 *
 * Explore used to skip listings matching the user's interests because they were
 * meant to appear in per-interest rows that were never rendered, so those
 * listings silently disappeared from Explore.
 */
export function buildHomeFeed(allItems, exploreLimit, exploreOrder = null) {
  const maxTotalItems = 50;
  const exploreCap = Math.min(
    maxTotalItems,
    Math.max(MIN_EXPLORE_ITEMS, exploreLimit),
  );
  const order =
    Array.isArray(exploreOrder) && exploreOrder.length === allItems.length
      ? exploreOrder
      : shuffleArray(allItems);

  return {
    forYouItems: [...allItems]
      .sort(
        (a, b) =>
          (b.recommendationScore || 0) - (a.recommendationScore || 0) ||
          (b.createdAtTs || 0) - (a.createdAtTs || 0),
      )
      .slice(0, maxTotalItems),
    exploreItems: order.slice(0, exploreCap),
  };
}
