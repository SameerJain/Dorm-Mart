import { formatLoginTimestamp, parseLoginTimestamp } from "./loggedDevicesUtils";

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
});
