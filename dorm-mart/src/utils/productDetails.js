import { FALLBACK_IMAGE_URL, resolveProductPhotoUrls } from "./imageFallback";
import { coerceNumber, parseListField } from "./formatters";

function coerceProductBoolean(value) {
  return typeof value === "boolean"
    ? value
    : String(value || "").toLowerCase() === "1" || String(value || "").toLowerCase() === "true";
}

export function normalizeProductDetail(data, { apiBase, publicBase } = {}) {
  if (!data) return null;

  const price = coerceNumber(data.listing_price ?? data.price) ?? 0;
  const sellerId = data.seller_id ?? null;
  const sellerEmail = data.email || null;
  const dateListedStr = data.date_listed || data.created_at || null;
  const dateSoldStr = data.date_sold || null;
  const photoUrls = resolveProductPhotoUrls(data.photos, { apiBase, publicBase });

  return {
    productId: data.product_id ?? data.id ?? null,
    title: data.title || data.product_title || "Untitled",
    description: data.description || data.product_description || "",
    price,
    photoUrls: photoUrls.length ? photoUrls : [FALLBACK_IMAGE_URL],
    tags: parseListField(data.tags),
    itemLocation: data.item_location || data.meet_location || data.location || null,
    itemCondition: data.item_condition || data.condition || null,
    trades: coerceProductBoolean(data.trades),
    priceNego: coerceProductBoolean(data.price_nego),
    sold: coerceProductBoolean(data.sold),
    sellerId,
    sellerName: data.seller || (sellerId != null ? `Seller #${sellerId}` : "Unknown Seller"),
    sellerUsername: data.seller_username || (sellerEmail ? sellerEmail.split("@")[0] : null),
    soldTo: data.sold_to ?? null,
    sellerEmail,
    dateListed: dateListedStr ? new Date(dateListedStr) : null,
    dateSold: dateSoldStr ? new Date(dateSoldStr) : null,
    finalPrice: data.final_price ?? null,
  };
}
