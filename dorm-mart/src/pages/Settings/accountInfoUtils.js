export function formatGraduationDate(month, year) {
  const monthNumber = Number(month);
  const yearNumber = Number(year);
  if (!Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12 || !Number.isInteger(yearNumber) || yearNumber < 1) return "Not available";
  return new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(new Date(yearNumber, monthNumber - 1, 1));
}

export function formatAccountDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value || "");
  if (!match) return "Not available";
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? "Not available" : new Intl.DateTimeFormat(undefined, { dateStyle: "long" }).format(date);
}
