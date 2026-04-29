export function parseListField(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value !== "string") return [];

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.filter(Boolean);
  } catch (_) {
    // Fall through to comma-separated parsing.
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function coerceNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.-]/g, "");
    if (!cleaned) return null;
    const num = Number(cleaned);
    return Number.isNaN(num) ? null : num;
  }
  return null;
}

export function coerceBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return null;
    if (
      ["1", "true", "yes", "y", "completed", "success", "successful"].includes(
        normalized,
      )
    )
      return true;
    if (["0", "false", "no", "n", "failed"].includes(normalized)) return false;
  }
  return null;
}

export function parseDateValue(value) {
  if (!value && value !== 0) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const dateFromNumber = new Date(value);
    return Number.isNaN(dateFromNumber.getTime()) ? null : dateFromNumber;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const normalized = trimmed.includes("T")
      ? trimmed
      : trimmed.replace(" ", "T");
    let attempt = new Date(normalized);
    if (Number.isNaN(attempt.getTime())) {
      attempt = new Date(`${trimmed}Z`);
    }
    return Number.isNaN(attempt.getTime()) ? null : attempt;
  }
  return null;
}

export function formatDate(value) {
  const date = parseDateValue(value);
  if (!date) return value instanceof Date ? "" : String(value);
  try {
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch (_) {
    return String(value);
  }
}

export function formatDateTime(value) {
  const date = parseDateValue(value);
  if (!date) return value instanceof Date ? "" : String(value);
  try {
    return date.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch (_) {
    return String(value);
  }
}

export function formatCurrency(value) {
  if (value === null || value === undefined || value === "") return null;
  const num = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(num)) return null;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(num);
}

export function humanizeStatus(input) {
  if (!input && input !== 0) return "";
  const raw = String(input).replace(/[_-]+/g, " ").trim();
  if (!raw) return "";
  return raw.replace(/\b\w/g, (c) => c.toUpperCase());
}
