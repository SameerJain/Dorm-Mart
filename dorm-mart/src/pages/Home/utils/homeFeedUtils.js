import keyboard from "../../../assets/product-images/keyboard.jpg";
import carpet from "../../../assets/product-images/smallcarpet.png";
import mouse from "../../../assets/product-images/wireless-mouse.jpg";
import { API_BASE, PUBLIC_BASE } from "../../../utils/apiConfig";
import { coerceNumber, dateTimestamp, parseListField } from "../../../utils/formatters";
import {
  resolveProductPhotoUrl,
  withFallbackImage,
} from "../../../utils/imageFallback";

export const MIN_EXPLORE_ITEMS = 30;
export const HOME_FEED_TAB_SESSION_KEY = "dm_home_feed_tab";

export const FALLBACK_ITEMS = [
  {
    id: 1,
    title: "Wireless Keyboard",
    price: 40,
    img: keyboard,
    tags: ["Electronics", "Accessories"],
    seller: "Ava P.",
    sellerUsername: "ava",
    sellerEmail: "ava@example.com",
    rating: 4.8,
    location: "North Campus",
    status: "JUST POSTED",
    category: "Electronics",
  },
  {
    id: 2,
    title: "Small Carpet (5x7)",
    price: 25,
    img: carpet,
    tags: ["Furniture", "Decor"],
    seller: "Mark D.",
    sellerUsername: "markd",
    sellerEmail: "mark@example.com",
    rating: 4.4,
    location: "Ellicott",
    status: "AVAILABLE",
    category: "Home & Dorm",
  },
  {
    id: 3,
    title: "Wireless Mouse",
    price: 30,
    img: mouse,
    tags: ["Electronics", "Accessories"],
    seller: "Sara T.",
    sellerUsername: "sarat",
    sellerEmail: "sara@example.com",
    rating: 4.9,
    location: "South Campus",
    status: "PRICE DROP",
    category: "Electronics",
  },
];

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
  if (width >= 768) return 30;
  return MIN_EXPLORE_ITEMS;
}

function shuffleArray(items) {
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

export function buildHomeFeed(allItems, interests, exploreLimit) {
  const maxTotalItems = 50;
  const exploreCap = Math.min(
    maxTotalItems,
    Math.max(MIN_EXPLORE_ITEMS, exploreLimit),
  );

  if (!interests.length) {
    return {
      itemsByInterest: {},
      forYouItems: [...allItems]
        .sort(
          (a, b) =>
            (b.recommendationScore || 0) - (a.recommendationScore || 0) ||
            (b.createdAtTs || 0) - (a.createdAtTs || 0),
        )
        .slice(0, maxTotalItems),
      exploreItems: shuffleArray(allItems).slice(0, exploreCap),
    };
  }

  const byInterest = {};
  interests.forEach((category) => {
    byInterest[category] = [];
  });

  allItems.forEach((item) => {
    const itemCategory = (item.category || "").toLowerCase();
    const itemTags = Array.isArray(item.tags)
      ? item.tags.map((tag) => tag.toLowerCase())
      : [];
    let best = null;

    for (const interest of interests) {
      const interestLower = interest.toLowerCase();
      const tagIndex = itemTags.indexOf(interestLower);
      if (tagIndex !== -1) {
        if (!best || best.kind !== "tag" || tagIndex < best.tagIndex) {
          best = { interest, kind: "tag", tagIndex };
        }
      } else if (itemCategory === interestLower && !best) {
        best = { interest, kind: "category" };
      }
    }

    if (best) byInterest[best.interest].push(item);
  });

  const used = new Set();
  Object.keys(byInterest).forEach((category) => {
    const categoryLower = category.toLowerCase();
    const visible = byInterest[category]
      .sort((a, b) => {
        const aPrimary = Array.isArray(a.tags)
          ? String(a.tags[0] || "").toLowerCase() === categoryLower
          : false;
        const bPrimary = Array.isArray(b.tags)
          ? String(b.tags[0] || "").toLowerCase() === categoryLower
          : false;
        if (aPrimary !== bPrimary) return aPrimary ? -1 : 1;
        return (b.createdAtTs || 0) - (a.createdAtTs || 0);
      })
      .slice(0, 10);
    byInterest[category] = visible;
    visible.forEach((item) => used.add(item.id));
  });

  return {
    itemsByInterest: byInterest,
    forYouItems: [...allItems]
      .sort(
        (a, b) =>
          (b.recommendationScore || 0) - (a.recommendationScore || 0) ||
          (b.createdAtTs || 0) - (a.createdAtTs || 0),
      )
      .slice(0, maxTotalItems),
    exploreItems: shuffleArray(allItems.filter((item) => !used.has(item.id))).slice(
      0,
      exploreCap,
    ),
  };
}
