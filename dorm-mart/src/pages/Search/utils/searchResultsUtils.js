import { coerceNumber, parseDateValue } from "../../../utils/formatters";
import { resolveProductPhotoUrl } from "../../../utils/imageFallback";

export const PRICE_FILTER_PATTERN = /^\d{0,4}(?:\.\d{0,2})?$/;

function isTrueQueryValue(value) {
  return value === "1" || String(value).toLowerCase() === "true";
}

export function readIncludeDescriptionPreference(query, storage) {
  const queryValue = query.get("desc") || query.get("includeDescription");
  if (queryValue !== null) return isTrueQueryValue(queryValue);

  try {
    return storage?.getItem("dm_include_desc") === "1";
  } catch {
    return false;
  }
}

export function getSearchTitle(payload) {
  const parts = [];
  if (payload.q) parts.push(`"${payload.q}"`);
  if (payload.category) parts.push(payload.category);
  return parts.length ? `Results for ${parts.join(" ")}` : "All Listings";
}

export function buildSearchPayload(query, includeDescription) {
  const fields = {
    q: query.get("q") || query.get("search") || null,
    category: query.get("category") || null,
    sort: query.get("sort") || null,
    condition: query.get("condition") || null,
    location: query.get("location") || null,
    minPrice: query.get("minPrice") || null,
    maxPrice: query.get("maxPrice") || null,
    status: query.get("status") || null,
  };
  const payload = Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value),
  );
  const categories = (query.get("categories") || "")
    .split(",")
    .map((category) => category.trim())
    .filter(Boolean);
  const priceNegotiable =
    query.get("priceNego") || query.get("priceNegotiable") || null;

  if (categories.length) payload.categories = categories;
  if (includeDescription) payload.includeDescription = true;
  if (isTrueQueryValue(priceNegotiable)) payload.priceNego = true;
  if (isTrueQueryValue(query.get("trades"))) payload.trades = true;

  return payload;
}

function queryPrice(value) {
  if (value === null || value === "") return null;
  const price = Number.parseFloat(value);
  return Number.isFinite(price) ? Math.max(0, Math.min(9999.99, price)) : null;
}

export function readSearchFilters(query) {
  const categories = (query.get("categories") || "")
    .split(",")
    .map((category) => category.trim())
    .filter(Boolean);
  const category = query.get("category");
  const sort = (query.get("sort") || "").toLowerCase();
  const firstPrice = queryPrice(query.get("minPrice"));
  const secondPrice = queryPrice(query.get("maxPrice"));
  const minPrice =
    firstPrice !== null && secondPrice !== null
      ? Math.min(firstPrice, secondPrice)
      : firstPrice;
  const maxPrice =
    firstPrice !== null && secondPrice !== null
      ? Math.max(firstPrice, secondPrice)
      : secondPrice;
  const priceNegotiable =
    query.get("priceNego") || query.get("priceNegotiable");
  const trades = query.get("trades");

  return {
    selectedCategories: Array.from(
      new Set(category ? [...categories, category] : categories),
    ),
    sortOrder:
      sort === "old" || sort === "oldest"
        ? "old"
        : sort === "new" || sort === "newest"
          ? "new"
          : sort === "best" ||
              sort === "best_match" ||
              sort === "relevance"
            ? "best"
            : "",
    minPrice: minPrice === null ? "" : String(minPrice),
    maxPrice: maxPrice === null ? "" : String(maxPrice),
    itemLocation: query.get("location") || "",
    itemCondition: query.get("condition") || "",
    priceNegotiable:
      priceNegotiable === "1" || priceNegotiable === "true",
    acceptingTrades: trades === "1" || trades === "true",
  };
}

function validateSearchPrice(value, label) {
  if (value === "" || value === null) return { price: null, error: "" };
  const trimmed = value.trim();
  const lowerLabel = label.toLowerCase();
  if (trimmed === "" || trimmed === "." || trimmed === "-") {
    return {
      price: null,
      error: `Please enter a valid ${lowerLabel} price`,
    };
  }

  const price = Number.parseFloat(trimmed);
  if (!Number.isFinite(price)) {
    return {
      price: null,
      error: `${label} price must be a valid number`,
    };
  }
  if (price < 0) {
    return { price, error: `${label} price cannot be negative` };
  }
  if (price > 9999.99) {
    return { price, error: `${label} price cannot exceed $9999.99` };
  }
  return { price, error: "" };
}

export function validateSearchPrices(minValue, maxValue) {
  const minimum = validateSearchPrice(minValue, "Minimum");
  const maximum = validateSearchPrice(maxValue, "Maximum");
  let error = maximum.error || minimum.error;

  if (
    !error &&
    minimum.price !== null &&
    maximum.price !== null &&
    minimum.price > maximum.price
  ) {
    error = "Minimum price cannot be greater than maximum price";
  }

  return {
    error,
    minPrice: minimum.price,
    maxPrice: maximum.price,
  };
}

export function buildSearchUrl({
  query,
  filters,
  includeDescription = false,
}) {
  const params = new URLSearchParams();
  const searchTerm = query.get("q") || query.get("search") || "";

  if (searchTerm) params.set("search", searchTerm);
  if (filters.selectedCategories.length) {
    params.set("categories", filters.selectedCategories.join(","));
  }
  if (["new", "old", "best"].includes(filters.sortOrder)) {
    params.set("sort", filters.sortOrder);
  }
  if (filters.minPrice !== null) {
    params.set("minPrice", String(filters.minPrice));
  }
  if (filters.maxPrice !== null) {
    params.set("maxPrice", String(filters.maxPrice));
  }
  if (filters.itemLocation) params.set("location", filters.itemLocation);
  if (filters.itemCondition) params.set("condition", filters.itemCondition);
  if (filters.priceNegotiable) params.set("priceNego", "1");
  if (filters.acceptingTrades) params.set("trades", "1");
  if (includeDescription) params.set("desc", "1");

  return `/app/listings?${params.toString()}`;
}

export function normalizeSearchResults(
  payload,
  { apiBase, publicBase, now = Date.now() } = {},
) {
  const results = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.items)
      ? payload.items
      : [];

  return results.map((result, index) => {
    const createdAt = parseDateValue(
      result.created_at || result.date_listed || null,
    );
    const rawImage = result.image || result.image_url || result.photo || null;

    return {
      id: result.id ?? result.product_id ?? index,
      title: result.title || result.product_title || "Untitled",
      price: coerceNumber(result.price ?? result.listing_price) ?? 0,
      img: rawImage
        ? resolveProductPhotoUrl(rawImage, {
            apiBase,
            publicBase,
            proxyUnknown: true,
          })
        : null,
      seller:
        result.seller ||
        result.seller_name ||
        result.sold_by ||
        (result.seller_id != null
          ? `Seller #${result.seller_id}`
          : "Unknown Seller"),
      createdAt,
      itemCondition: result.item_condition || result.condition || null,
      itemLocation:
        result.item_location || result.meet_location || result.location || null,
      status:
        result.status ||
        (createdAt && (now - createdAt.getTime()) / 36e5 < 48
          ? "JUST POSTED"
          : "AVAILABLE"),
    };
  });
}
