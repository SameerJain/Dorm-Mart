import { formatLoginTimestamp, parseLoginTimestamp } from "../../../pages/Settings/loggedDevicesUtils";

describe("logged device timestamps", () => {
  test("parses database timestamps as UTC", () => {
    const parsed = parseLoginTimestamp("2026-08-14T13:05:00Z");
    expect(parsed).toEqual(new Date("2026-08-14T13:05:00Z"));
  });

  test("formats a readable login time", () => {
    const value = "2026-08-14T13:05:00Z";
    expect(formatLoginTimestamp(value)).toBe(
      new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date("2026-08-14T13:05:00Z")),
    );
  });

  test("uses a safe fallback for invalid timestamps", () => {
    expect(parseLoginTimestamp("not-a-date")).toBeNull();
    expect(formatLoginTimestamp("")).toBe("Unknown time");
  });

  test("treats legacy timezone-less database values as UTC", () => {
    expect(parseLoginTimestamp("2026-08-14 13:05:00")).toEqual(
      new Date("2026-08-14T13:05:00Z"),
    );
  });

  test("respects an explicit offset instead of adding a second zone", () => {
    expect(parseLoginTimestamp("2026-08-14T13:05:00+05:30")).toEqual(new Date("2026-08-14T07:35:00Z"));
    expect(parseLoginTimestamp("2026-08-14 13:05:00-04:00")).toEqual(new Date("2026-08-14T17:05:00Z"));
    expect(parseLoginTimestamp("2026-08-14T13:05:00z")).toEqual(new Date("2026-08-14T13:05:00Z"));
  });

  test("trims surrounding spaces and only converts the first space", () => {
    expect(parseLoginTimestamp("  2026-08-14 13:05:00  ")).toEqual(new Date("2026-08-14T13:05:00Z"));
    expect(parseLoginTimestamp("2026-08-14 13:05:00 extra")).toBeNull();
  });

  test.each([null, undefined, "", "   ", 5, {}, new Date(), "not-a-date", "2026-13-45 99:99:99"])(
    "rejects %p",
    (value) => {
      expect(parseLoginTimestamp(value)).toBeNull();
    },
  );

  test("a date with no time is read as midnight UTC", () => {
    expect(parseLoginTimestamp("2026-08-14T00:00")).toEqual(new Date("2026-08-14T00:00:00Z"));
  });

  test("a malformed offset is not mistaken for a real one", () => {
    // Without a valid zone it is read as UTC, which the date parser then rejects.
    expect(parseLoginTimestamp("2026-08-14T13:05:00+5:30")).toBeNull();
  });

  test("formatting gives the same text for equivalent zone spellings and never throws", () => {
    expect(formatLoginTimestamp("2026-08-14 13:05:00")).toBe(formatLoginTimestamp("2026-08-14T13:05:00Z"));
    expect(formatLoginTimestamp("2026-08-14T15:05:00+02:00")).toBe(formatLoginTimestamp("2026-08-14T13:05:00Z"));
    for (const value of [null, undefined, "junk", 12]) {
      expect(formatLoginTimestamp(value)).toBe("Unknown time");
    }
    expect(formatLoginTimestamp("2026-08-14T13:05:00Z")).not.toBe(formatLoginTimestamp("2026-08-15T13:05:00Z"));
  });
});
