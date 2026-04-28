export const PUBLIC_BASE = (process.env.PUBLIC_URL || "").replace(/\/$/, "");

export const API_BASE = (
  process.env.REACT_APP_API_BASE || `${PUBLIC_BASE}/api`
).replace(/\/$/, "");

export function apiPath(path) {
  const normalizedPath = String(path || "").replace(/^\/+/, "");
  return `${API_BASE}/${normalizedPath}`;
}
