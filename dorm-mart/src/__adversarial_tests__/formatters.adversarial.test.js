import {
  coerceNumber,
  compareDateAsc,
  compareDateDesc,
  dateTimestamp,
  parseDateValue,
} from "../utils/formatters";

describe("formatter adversarial boundaries", () => {
  test("coerceNumber accepts currency-like numbers without extracting numbers from prose", () => {
    expect(coerceNumber("$1,234.50")).toBe(1234.5);
    expect(coerceNumber(" 99.95 ")).toBe(99.95);
    expect(coerceNumber("abc123")).toBeNull();
    expect(coerceNumber("12 dollars")).toBeNull();
    expect(coerceNumber(Infinity)).toBeNull();
  });

  test("parseDateValue returns null for invalid date-like strings", () => {
    expect(parseDateValue("not-a-date")).toBeNull();
    expect(parseDateValue(new Date("bad date"))).toBeNull();
  });

  test("date timestamp and comparators handle invalid dates without leaking NaN", () => {
    expect(dateTimestamp("not-a-date", 0)).toBe(0);
    expect(Number.isFinite(dateTimestamp("2026-01-02T00:00:00Z"))).toBe(true);

    const values = ["2026-01-02T00:00:00Z", "bad", "2026-01-01T00:00:00Z"];
    expect([...values].sort(compareDateAsc)).toEqual([
      "2026-01-01T00:00:00Z",
      "2026-01-02T00:00:00Z",
      "bad",
    ]);
    expect([...values].sort(compareDateDesc)).toEqual([
      "2026-01-02T00:00:00Z",
      "2026-01-01T00:00:00Z",
      "bad",
    ]);
  });
});
