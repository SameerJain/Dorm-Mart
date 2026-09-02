import { MAX_LISTING_PRICE } from "../../../utils/priceValidation";

export const CATEGORIES_MAX = 3;
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 25 * 1024 * 1024;
export const PRICE_INPUT_PATTERN = /^\d{0,4}(?:\.\d{0,2})?$/;
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
export const ALLOWED_VIDEO_MIME_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);
export const ALLOWED_VIDEO_EXTENSIONS = new Set([".mp4", ".webm", ".mov"]);

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

export function hasListingPhoto(media) {
  return Array.isArray(media) && media.some((item) => item?.type === "image");
}

function fileExtension(file) {
  const name = (file?.name || "").toLowerCase();
  return name.slice(name.lastIndexOf("."));
}

export function isListingVideo(file) {
  return file?.type
    ? ALLOWED_VIDEO_MIME_TYPES.has(file.type)
    : ALLOWED_VIDEO_EXTENSIONS.has(fileExtension(file));
}

export function isAllowedListingMedia(file) {
  if (file?.type) {
    return (
      ALLOWED_IMAGE_MIME_TYPES.has(file.type) ||
      ALLOWED_VIDEO_MIME_TYPES.has(file.type)
    );
  }
  const extension = fileExtension(file);
  return (
    ALLOWED_IMAGE_EXTENSIONS.has(extension) ||
    ALLOWED_VIDEO_EXTENSIONS.has(extension)
  );
}

export function getPreviewBoxSize() {
  if (typeof window === "undefined") {
    return 480;
  }

  const isMobile = window.innerWidth < 768;
  return isMobile ? Math.min(480, window.innerWidth - 80) : 480;
}
