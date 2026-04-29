import { MAX_LISTING_PRICE } from "../../../utils/priceValidation";

export const CATEGORIES_MAX = 3;
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const PRICE_INPUT_PATTERN = /^\d*\.?\d*$/;
export const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
export const ALLOWED_IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
]);

export const LIMITS = {
  title: 50,
  description: 1000,
  price: MAX_LISTING_PRICE,
  priceMin: 0.01,
  images: 6,
  maxActiveListings: 25,
};

export const DEFAULT_FORM = {
  title: "",
  categories: [],
  itemLocation: "",
  condition: "",
  description: "",
  price: "",
  acceptTrades: false,
  priceNegotiable: false,
  images: [],
};

export function getPreviewBoxSize() {
  if (typeof window === "undefined") {
    return 480;
  }

  const isMobile = window.innerWidth < 768;
  return isMobile ? Math.min(480, window.innerWidth - 80) : 480;
}
