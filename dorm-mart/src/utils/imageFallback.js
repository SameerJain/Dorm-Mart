/** SVG placeholder (data URL) — works offline, dark-theme friendly, no missing static file. */
const ITEM_PLACEHOLDER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800" role="img" aria-hidden="true"><defs><linearGradient id="dm-ph" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#475569"/><stop offset="100%" stop-color="#1e293b"/></linearGradient></defs><rect width="800" height="800" fill="url(#dm-ph)"/><g fill="none" stroke="#94a3b8" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"><rect x="210" y="230" width="380" height="280" rx="24" ry="24"/><circle cx="310" cy="330" r="42"/><path d="M210 450 L330 330 L430 400 L590 270 L590 510 L210 510 Z"/></g><text x="400" y="600" text-anchor="middle" fill="#cbd5e1" font-family="ui-sans-serif,system-ui,sans-serif" font-size="34" font-weight="600" letter-spacing="0.04em">No photo</text></svg>`;

export const FALLBACK_IMAGE_URL = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(ITEM_PLACEHOLDER_SVG)}`;

/**
 * Map DB-stored paths (/images/, /data/images/, /media/) to the PHP image endpoint so the
 * browser loads files from the API host (needed for Railway / SPA-only static hosts where
 * /images/ is not served from disk). Does not wrap blob:, data:, or URLs already using image.php.
 * Absolute http(s) URLs are returned unchanged (image.php only resolves local paths).
 *
 * @param {unknown} raw
 * @param {string} apiBase e.g. process.env.REACT_APP_API_BASE or `${PUBLIC_URL}/api`, no trailing slash
 * @returns {string}
 */
export function resolveStoredImageUrl(raw, apiBase) {
  if (raw == null) return "";
  const s = String(raw).trim();
  if (!s) return "";
  if (s.startsWith("blob:") || s.startsWith("data:")) return s;
  if (s.includes("/media/image.php")) return s;

  const base = String(apiBase || "").replace(/\/$/, "");
  if (!base) return s;

  if (/^https?:\/\//i.test(s)) {
    try {
      const u = new URL(s);
      if (u.pathname.includes("media/image.php")) return s;
    } catch {
      /* ignore */
    }
    return s;
  }

  if (s.startsWith("/data/images/") || s.startsWith("/images/") || s.startsWith("/media/")) {
    return `${base}/media/image.php?url=${encodeURIComponent(s)}`;
  }

  return s;
}

export function withFallbackImage(url) {
  if (typeof url === "string" && url.trim() !== "") {
    return url;
  }
  return FALLBACK_IMAGE_URL;
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
