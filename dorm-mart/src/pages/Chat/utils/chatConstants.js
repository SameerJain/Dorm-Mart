// Single source of truth for chat message limits and composer sizing.
// Server counts Unicode code points (mb_strlen), not UTF-16 units, so
// callers that count characters must use Array.from(text).length.
export const CHAT_MAX_LENGTH = 500;

// Composer textarea collapsed heights (collapsed single-line row).
export const COMPOSER_MIN_HEIGHT_DESKTOP = 44;
export const COMPOSER_MIN_HEIGHT_MOBILE = 48;

export function chatCharCount(text) {
  return Array.from(text || "").length;
}
