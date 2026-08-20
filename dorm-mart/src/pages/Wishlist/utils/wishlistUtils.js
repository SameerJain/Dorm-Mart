import {
  coerceNumber,
  parseDateValue,
  parseListField,
} from "../../../utils/formatters";
import { resolveProductPhotoUrl } from "../../../utils/imageFallback";

export function normalizeWishlistItems(
  payload,
  { apiBase, publicBase, now = Date.now() } = {},
) {
  if (!payload?.success || !Array.isArray(payload.data)) return [];

  return payload.data.map((item) => {
    const createdAt = parseDateValue(item.created_at || item.date_listed);
    const sellerEmail = item.email || item.seller_email || null;

    return {
      id: item.product_id,
      title: item.title || "Untitled",
      price: coerceNumber(item.price) ?? 0,
      img: item.image_url
        ? resolveProductPhotoUrl(item.image_url, {
            apiBase,
            publicBase,
            proxyUnknown: true,
          })
        : null,
      tags: parseListField(item.tags ?? item.categories),
      status:
        item.status ||
        (createdAt && (now - createdAt.getTime()) / 36e5 < 48
          ? "JUST POSTED"
          : "AVAILABLE"),
      seller: item.seller || "Unknown Seller",
      sellerUsername:
        item.seller_username ||
        (typeof sellerEmail === "string" ? sellerEmail.split("@")[0] : null),
      sellerEmail,
    };
  });
}

export function getWishlistCategories(items) {
  const categories = new Set();
  for (const item of items) {
    for (const tag of Array.isArray(item.tags) ? item.tags : []) {
      if (typeof tag === "string" && tag) categories.add(tag);
    }
  }
  return Array.from(categories).sort();
}

export function filterWishlistItems(items, selectedCategory) {
  if (!selectedCategory) return items;
  const category = selectedCategory.toLowerCase();
  return items.filter((item) =>
    (Array.isArray(item.tags) ? item.tags : []).some(
      (tag) => String(tag).toLowerCase() === category,
    ),
  );
}

export function selectedCategoryAfterRemoval(items, selectedCategory) {
  if (!selectedCategory) return null;
  return filterWishlistItems(items, selectedCategory).length
    ? selectedCategory
    : null;
}
