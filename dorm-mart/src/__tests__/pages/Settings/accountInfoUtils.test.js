import { formatAccountDate, formatGraduationDate, isValidPhoneNumber } from "../../../pages/Settings/accountInfoUtils";

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

  test("graduation months 1 and 12 are valid; 0, 13 and non-integers are not", () => {
    const monthYear = (month, year) =>
      new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));
    expect(formatGraduationDate(1, 2027)).toBe(monthYear(1, 2027));
    expect(formatGraduationDate("12", "2027")).toBe(monthYear(12, 2027));
    for (const month of [0, -1, 13, 1.5, "abc", null, undefined]) {
      expect(formatGraduationDate(month, 2027)).toBe("Not available");
    }
  });

  test("graduation years must be positive whole numbers", () => {
    expect(formatGraduationDate(5, 0)).toBe("Not available");
    expect(formatGraduationDate(5, -2027)).toBe("Not available");
    expect(formatGraduationDate(5, 2027.5)).toBe("Not available");
    expect(formatGraduationDate(5, "abc")).toBe("Not available");
    expect(formatGraduationDate(5, undefined)).toBe("Not available");
    expect(formatGraduationDate(5, 1)).not.toBe("Not available");
  });

  test("account dates use the calendar day written, ignoring any time part", () => {
    const long = (y, m, d) => new Intl.DateTimeFormat(undefined, { dateStyle: "long" }).format(new Date(y, m - 1, d));
    expect(formatAccountDate("2025-12-31 23:59:59")).toBe(long(2025, 12, 31));
    expect(formatAccountDate("2025-01-01T00:00:00Z")).toBe(long(2025, 1, 1));
    expect(formatAccountDate("2025-08-20")).not.toBe(formatAccountDate("2025-08-21"));
  });

  test("account dates need a full leading YYYY-MM-DD", () => {
    for (const value of ["", null, undefined, "2025-8-20", "25-08-20", "x2025-08-20", " 2025-08-20", "08/20/2025"]) {
      expect(formatAccountDate(value)).toBe("Not available");
    }
  });
});

describe("isValidPhoneNumber", () => {
  test.each(["7165551234", "(716) 555-1234", "+1 716.555.1234", "  716-555-1234  ", "5"])("accepts %p", (value) => {
    expect(isValidPhoneNumber(value)).toBe(true);
  });

  test.each([
    "",
    "   ",
    "()",
    "+ - .",
    "call me",
    "716-555-1234x",
    "x716-555-1234",
    "12345678901234567890123456",
    null,
    undefined,
    7165551234,
  ])("rejects %p", (value) => {
    expect(isValidPhoneNumber(value)).toBe(false);
  });

  test("length is capped at 25 characters", () => {
    expect(isValidPhoneNumber("1".repeat(25))).toBe(true);
    expect(isValidPhoneNumber("1".repeat(26))).toBe(false);
  });
});
