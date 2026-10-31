import {
  coerceBoolean,
  coerceNumber,
  compareDateAsc,
  compareDateDesc,
  dateTimestamp,
  formatCurrency,
  formatDate,
  formatDateTime,
  humanizeStatus,
  parseDateValue,
  parseListField,
} from "../../utils/formatters";

describe("parseListField", () => {
  test("arrays and JSON arrays are kept, minus empty entries", () => {
    expect(parseListField(["a", "", null, "b", 0, undefined])).toEqual(["a", "b"]);
    expect(parseListField('["a","",null,"b"]')).toEqual(["a", "b"]);
    expect(parseListField("[]")).toEqual([]);
  });

  test("anything else that is a string is split on commas, trimmed, without blanks", () => {
    expect(parseListField("a, b ,, c ")).toEqual(["a", "b", "c"]);
    expect(parseListField("solo")).toEqual(["solo"]);
    expect(parseListField("")).toEqual([]);
    expect(parseListField(" , ")).toEqual([]);
    // JSON that is not a list is text, not data.
    expect(parseListField('{"a":1}')).toEqual(['{"a":1}']);
    expect(parseListField("123")).toEqual(["123"]);
    expect(parseListField("[bad, json")).toEqual(["[bad", "json"]);
  });

  test("non-strings that are not arrays give an empty list", () => {
    for (const value of [null, undefined, 5, {}, true]) {
      expect(parseListField(value)).toEqual([]);
    }
  });
});

describe("coerceNumber", () => {
  test.each([
    [12, 12],
    [0, 0],
    [-3.5, -3.5],
    ["12", 12],
    ["0", 0],
    ["+12", 12],
    ["-12.5", -12.5],
    ["$12", 12],
    ["-$12", -12],
    ["$1,234.50", 1234.5],
    ["1,234,567", 1234567],
    ["  7  ", 7],
    [".5", 0.5],
    ["12.", null],
  ])("%p becomes %p", (input, expected) => {
    expect(coerceNumber(input)).toBe(expected);
  });

  test.each([
    null,
    undefined,
    "",
    "   ",
    "abc",
    "12abc",
    "abc12",
    "$",
    "1,23",
    "12,34",
    "1,2345",
    "1e3",
    "1 2",
    "--5",
    "$$5",
    "12 dollars",
    NaN,
    Infinity,
    -Infinity,
    true,
    {},
    [],
  ])("%p is rejected", (input) => {
    expect(coerceNumber(input)).toBeNull();
  });

  test("a huge digit string that overflows is rejected", () => {
    expect(coerceNumber("9".repeat(400))).toBeNull();
  });
});

describe("coerceBoolean", () => {
  test.each([true, "1", "true", "TRUE", " yes ", "Y", "completed", "success", "Successful", 1, 2, -1])(
    "%p is true",
    (value) => {
      expect(coerceBoolean(value)).toBe(true);
    },
  );

  test.each([false, "0", "false", "No", "n", "FAILED", 0])("%p is false", (value) => {
    expect(coerceBoolean(value)).toBe(false);
  });

  test.each(["", "   ", "maybe", "2", "truthy", null, undefined, {}, []])("%p is undecided (null)", (value) => {
    expect(coerceBoolean(value)).toBeNull();
  });
});

describe("parseDateValue", () => {
  test("passes a valid Date through and rejects an invalid one", () => {
    const date = new Date(2026, 0, 15);
    expect(parseDateValue(date)).toBe(date);
    expect(parseDateValue(new Date("bad"))).toBeNull();
  });

  test("numbers are milliseconds, including zero", () => {
    expect(parseDateValue(1700000000000).getTime()).toBe(1700000000000);
    expect(parseDateValue(0).getTime()).toBe(0);
    expect(parseDateValue(NaN)).toBeNull();
    expect(parseDateValue(Infinity)).toBeNull();
    expect(parseDateValue(8.64e15 + 1)).toBeNull();
  });

  test("strings: ISO, space-separated, and zone-less forms", () => {
    expect(parseDateValue("2026-01-15T12:00:00Z").getTime()).toBe(Date.UTC(2026, 0, 15, 12));
    expect(parseDateValue(" 2026-01-15T12:00:00Z ").getTime()).toBe(Date.UTC(2026, 0, 15, 12));
    // A space between date and time is read as local time, the same as a T.
    expect(parseDateValue("2026-01-15 12:30:00").getTime()).toBe(new Date(2026, 0, 15, 12, 30).getTime());
    expect(parseDateValue("2026-01-15T12:30:00").getTime()).toBe(new Date(2026, 0, 15, 12, 30).getTime());
  });

  test("only the first space becomes a T", () => {
    expect(parseDateValue("2026-01-15 12:30:00 extra")).toBeNull();
  });

  test("everything else is null", () => {
    for (const value of ["", "   ", "not-a-date", null, undefined, false, {}, []]) {
      expect(parseDateValue(value)).toBeNull();
    }
  });
});

describe("dateTimestamp and the comparators", () => {
  test("timestamp, or the fallback for anything unreadable", () => {
    expect(dateTimestamp("2026-01-15T12:00:00Z")).toBe(Date.UTC(2026, 0, 15, 12));
    expect(dateTimestamp("bad")).toBeNull();
    expect(dateTimestamp("bad", 7)).toBe(7);
    expect(dateTimestamp(0, 7)).toBe(0);
    expect(dateTimestamp(null, 0)).toBe(0);
  });

  test("ascending puts earlier first and undated last; equal is zero", () => {
    expect(compareDateAsc("2026-01-01T00:00:00Z", "2026-01-02T00:00:00Z")).toBeLessThan(0);
    expect(compareDateAsc("2026-01-02T00:00:00Z", "2026-01-01T00:00:00Z")).toBeGreaterThan(0);
    expect(compareDateAsc("2026-01-01T00:00:00Z", "2026-01-01T00:00:00Z")).toBe(0);
    expect(compareDateAsc("bad", "2026-01-01T00:00:00Z")).toBeGreaterThan(0);
    expect(compareDateAsc("bad", "worse")).toBe(0);
    expect(compareDateAsc("bad", "2026-01-01T00:00:00Z", 0)).toBeLessThan(0);
  });

  test("descending puts later first and undated last; equal is zero", () => {
    expect(compareDateDesc("2026-01-02T00:00:00Z", "2026-01-01T00:00:00Z")).toBeLessThan(0);
    expect(compareDateDesc("2026-01-01T00:00:00Z", "2026-01-02T00:00:00Z")).toBeGreaterThan(0);
    expect(compareDateDesc("2026-01-01T00:00:00Z", "2026-01-01T00:00:00Z")).toBe(0);
    expect(compareDateDesc("bad", "2026-01-01T00:00:00Z")).toBeGreaterThan(0);
    expect(compareDateDesc("bad", "worse")).toBe(0);
  });
});

describe("formatDate and formatDateTime", () => {
  // Zone-less strings are read as local time, so these hold in any time zone.
  test("dates show the month, day and year written", () => {
    const text = formatDate("2026-01-15 12:00:00");
    expect(text).toContain("Jan");
    expect(text).toContain("15");
    expect(text).toContain("2026");
    expect(text).not.toMatch(/12|PM|AM/);
  });

  test("date-times add a 12-hour clock", () => {
    const text = formatDateTime("2026-01-15 13:05:00");
    expect(text).toContain("Jan");
    expect(text).toContain("15");
    expect(text).toContain("2026");
    expect(text).toMatch(/1:05\s?PM/i);
    expect(formatDateTime("2026-01-15 00:07:00")).toMatch(/12:07\s?AM/i);
  });

  test("unreadable values are shown as written, and an invalid Date as blank", () => {
    expect(formatDate("soon")).toBe("soon");
    expect(formatDateTime("soon")).toBe("soon");
    expect(formatDate(null)).toBe("null");
    expect(formatDate(undefined)).toBe("undefined");
    expect(formatDateTime("")).toBe("");
    expect(formatDate(new Date("bad"))).toBe("");
    expect(formatDateTime(new Date("bad"))).toBe("");
  });

  test("a formatting failure falls back to the raw value", () => {
    const spy = jest.spyOn(Date.prototype, "toLocaleDateString").mockImplementation(() => {
      throw new RangeError("bad locale");
    });
    const spyTime = jest.spyOn(Date.prototype, "toLocaleString").mockImplementation(() => {
      throw new RangeError("bad locale");
    });
    try {
      expect(formatDate("2026-01-15 12:00:00")).toBe("2026-01-15 12:00:00");
      expect(formatDateTime("2026-01-15 12:00:00")).toBe("2026-01-15 12:00:00");
    } finally {
      spy.mockRestore();
      spyTime.mockRestore();
    }
  });
});

describe("formatCurrency", () => {
  test("US dollars with two decimals and thousands separators", () => {
    expect(formatCurrency(12)).toBe("$12.00");
    expect(formatCurrency("12.5")).toBe("$12.50");
    expect(formatCurrency(0)).toBe("$0.00");
    expect(formatCurrency(1234567.891)).toBe("$1,234,567.89");
    expect(formatCurrency(-5)).toBe("-$5.00");
  });

  test("empty and non-numeric values give null", () => {
    for (const value of [null, undefined, "", "abc", NaN]) {
      expect(formatCurrency(value)).toBeNull();
    }
  });
});

describe("humanizeStatus", () => {
  test("underscores and hyphens become spaces and each word is capitalised", () => {
    expect(humanizeStatus("in_progress")).toBe("In Progress");
    expect(humanizeStatus("needs-response")).toBe("Needs Response");
    expect(humanizeStatus("a__b--c")).toBe("A B C");
    expect(humanizeStatus("  padded_value  ")).toBe("Padded Value");
    expect(humanizeStatus("ALREADY_UPPER")).toBe("ALREADY UPPER");
    expect(humanizeStatus("sold")).toBe("Sold");
  });

  test("zero is a value; other empty input gives an empty string", () => {
    expect(humanizeStatus(0)).toBe("0");
    expect(humanizeStatus(7)).toBe("7");
    for (const value of ["", "   ", "___", "-", null, undefined, false]) {
      expect(humanizeStatus(value)).toBe("");
    }
  });
});
