const XSS_PATTERNS = [
  /<script/i,
  /javascript:/i,
  /onerror=/i,
  /onload=/i,
  /onclick=/i,
  /<iframe/i,
  /<object/i,
  /<embed/i,
  /<img[^>]*on/i,
  /<svg[^>]*on/i,
  /vbscript:/i,
];

export function containsXssPattern(value) {
  if (value === null || value === undefined) return false;
  return XSS_PATTERNS.some((pattern) => pattern.test(String(value)));
}
