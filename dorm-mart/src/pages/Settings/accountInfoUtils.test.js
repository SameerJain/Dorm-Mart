import { formatAccountDate, formatGraduationDate } from "./accountInfoUtils";

describe("account information formatting", () => {
  test("formats graduation month and year", () => {
    expect(formatGraduationDate(5, 2027)).toBe(
      new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(new Date(2027, 4, 1)),
    );
  });

  test("formats local account dates without a timezone shift", () => {
    expect(formatAccountDate("2025-08-20")).toBe(
      new Intl.DateTimeFormat(undefined, { dateStyle: "long" }).format(new Date(2025, 7, 20)),
    );
  });

  test("uses a neutral fallback for invalid values", () => {
    expect(formatGraduationDate(13, 2027)).toBe("Not available");
    expect(formatAccountDate("bad-date")).toBe("Not available");
  });
});
