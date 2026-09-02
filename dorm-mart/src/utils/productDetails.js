import { FALLBACK_IMAGE_URL, resolveProductPhotoUrls } from "./imageFallback";
import {
  coerceBoolean,
  coerceNumber,
  parseDateValue,
  parseListField,
} from "./formatters";

function coerceProductBoolean(value) {
  return coerceBoolean(value) === true;
}

function normalizeEmail(value) {
  if (typeof value !== "string") return value || null;
  const trimmed = value.trim();
  return trimmed || null;
}

function deriveSellerUsername(sellerUsername, sellerEmail) {
  if (typeof sellerUsername === "string" && sellerUsername.trim()) {
    return sellerUsername.trim();
  }

  if (typeof sellerEmail !== "string") return null;
  const localPart = sellerEmail.split("@")[0]?.trim();
  return localPart || null;
}

export function normalizeProductDetail(data, { apiBase, publicBase } = {}) {
  if (!data) return null;

  const price = coerceNumber(data.listing_price ?? data.price) ?? 0;
  const sellerId = data.seller_id ?? null;
  const sellerEmail = normalizeEmail(data.email);
  const dateListedStr = data.date_listed || data.created_at || null;
  const dateSoldStr = data.date_sold || null;
  const photoUrls = resolveProductPhotoUrls(data.photos, {
    apiBase,
    publicBase,
  });

  return {
    productId: data.product_id ?? data.id ?? null,
    title: data.title || data.product_title || "Untitled",
    description: data.description || data.product_description || "",
    price,
    photoUrls: photoUrls.length ? photoUrls : [FALLBACK_IMAGE_URL],
    tags: parseListField(data.tags),
    itemLocation:
      data.item_location || data.meet_location || data.location || null,
    itemCondition: data.item_condition || data.condition || null,
    trades: coerceProductBoolean(data.trades),
    priceNego: coerceProductBoolean(data.price_nego),
    sold: coerceProductBoolean(data.sold),
    sellerId,
    sellerName:
      data.seller ||
      (sellerId != null ? `Seller #${sellerId}` : "Unknown Seller"),
    sellerUsername: deriveSellerUsername(data.seller_username, sellerEmail),
    soldTo: data.sold_to ?? null,
    sellerEmail,
    dateListed: parseDateValue(dateListedStr),
    dateSold: parseDateValue(dateSoldStr),
    finalPrice: data.final_price ?? null,
  };
}
