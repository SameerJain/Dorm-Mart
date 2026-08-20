export function parseLoginTimestamp(value) {
  if (typeof value !== "string" || !value.trim()) return null;

  const normalized = value.trim().replace(" ", "T");
  const parsed = new Date(/[zZ]|[+-]\d{2}:\d{2}$/.test(normalized) ? normalized : `${normalized}Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatLoginTimestamp(value) {
  const parsed = parseLoginTimestamp(value);
  if (!parsed) return "Unknown time";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}
