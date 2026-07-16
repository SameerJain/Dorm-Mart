/** SVG placeholder (data URL) — works offline, dark-theme friendly, no missing static file. */
const ITEM_PLACEHOLDER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800" role="img" aria-hidden="true"><defs><linearGradient id="dm-ph" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#475569"/><stop offset="100%" stop-color="#1e293b"/></linearGradient></defs><rect width="800" height="800" fill="url(#dm-ph)"/><g fill="none" stroke="#94a3b8" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"><rect x="210" y="230" width="380" height="280" rx="24" ry="24"/><circle cx="310" cy="330" r="42"/><path d="M210 450 L330 330 L430 400 L590 270 L590 510 L210 510 Z"/></g><text x="400" y="600" text-anchor="middle" fill="#cbd5e1" font-family="ui-sans-serif,system-ui,sans-serif" font-size="34" font-weight="600" letter-spacing="0.04em">No photo</text></svg>`;

export const FALLBACK_IMAGE_URL = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(ITEM_PLACEHOLDER_SVG)}`;

const LOCAL_IMAGE_PREFIXES = ["/data/images/", "/images/", "/media/"];

function normalizeImageInput(raw) {
  return typeof raw === "string" ? raw.trim() : "";
}

function isPassthroughImageUrl(url) {
  const lower = url.toLowerCase();
  return (
    lower.startsWith("blob:") ||
    lower.startsWith("data:") ||
    url.includes("/media/image.php")
  );
}

function localStoredImagePath(url) {
  if (LOCAL_IMAGE_PREFIXES.some((prefix) => url.startsWith(prefix))) {
    return url;
  }

  if (/^https?:\/\//i.test(url)) {
    try {
      const parsed = new URL(url);
      if (
        LOCAL_IMAGE_PREFIXES.some((prefix) =>
          parsed.pathname.startsWith(prefix),
        )
      ) {
        return `${parsed.pathname}${parsed.search}`;
      }
    } catch {
      return "";
    }
  }

  return "";
}

function proxyStoredImage(base, path) {
  return `${base}/media/image.php?url=${encodeURIComponent(path)}`;
}

/**
 * Map DB-stored paths (/images/, /data/images/, /media/) to the PHP image endpoint so the
 * browser loads files from the API host (needed for Railway / SPA-only static hosts where
 * /images/ is not served from disk). Does not wrap blob:, data:, or URLs already using image.php.
 * External http(s) URLs are returned unchanged; absolute URLs with local stored-image paths
 * are proxied by path because image.php only resolves local paths.
 *
 * @param {unknown} raw
 * @param {string} apiBase e.g. process.env.REACT_APP_API_BASE or `${PUBLIC_URL}/api`, no trailing slash
 * @returns {string}
 */
export function resolveStoredImageUrl(raw, apiBase) {
  const s = normalizeImageInput(raw);
  if (!s) return "";
  if (isPassthroughImageUrl(s)) return s;

  const base = String(apiBase || "").replace(/\/$/, "");
  if (!base) return s;

  const storedPath = localStoredImagePath(s);
  if (storedPath) return proxyStoredImage(base, storedPath);

  return s;
}

export function resolveProductPhotoUrl(
  raw,
  { apiBase, publicBase = "", proxyUnknown = false } = {},
) {
  const s = normalizeImageInput(raw);
  if (!s) return "";
  if (isPassthroughImageUrl(s)) return s;

  const base = String(apiBase || "").replace(/\/$/, "");
  const storedPath = localStoredImagePath(s);
  if (base && storedPath) {
    return proxyStoredImage(base, storedPath);
  }
  if (base && proxyUnknown && !/^https?:\/\//i.test(s)) {
    return proxyStoredImage(base, s);
  }

  const publicRoot = String(publicBase || "").replace(/\/$/, "");
  return s.startsWith("/") ? `${publicRoot}${s}` : s;
}

export function resolveProductPhotoUrls(photos, options = {}) {
  let list = [];
  if (Array.isArray(photos)) {
    list = photos;
  } else if (typeof photos === "string") {
    try {
      const parsed = JSON.parse(photos);
      list = Array.isArray(parsed) ? parsed : photos.split(",");
    } catch (_) {
      list = photos.split(",");
    }
  }

  return list
    .map((photo) => resolveProductPhotoUrl(photo, options))
    .filter(Boolean);
}

function sanitizeImageSrc(url) {
  if (typeof url !== "string" || url.trim() === "") return "";
  const s = url.trim();
  const lower = s.toLowerCase();
  if (
    lower.startsWith("blob:") ||
    lower.startsWith("data:image/") ||
    s.startsWith("/") ||
    s.startsWith("./") ||
    /^https?:\/\//i.test(s)
  ) return s;
  return "";
}

export function withFallbackImage(url) {
  const safe = sanitizeImageSrc(url);
  return safe !== "" ? safe : FALLBACK_IMAGE_URL;
}

/**
 * Use on listing/product img elements when the URL may 404 (missing file, bad path).
 * Prevents infinite loops if the placeholder itself fails.
 */
export function onProductImageError(event) {
  const el = event.currentTarget;
  el.onerror = null;
  el.src = FALLBACK_IMAGE_URL;
}
