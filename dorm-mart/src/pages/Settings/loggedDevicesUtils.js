export function parseLoginTimestamp(value) {
  if (typeof value !== "string" || !value.trim()) return null;

  const parsed = new Date(value.trim().replace(" ", "T"));
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
