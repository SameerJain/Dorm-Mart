import { formatLoginTimestamp, parseLoginTimestamp } from "./loggedDevicesUtils";

describe("logged device timestamps", () => {
  test("parses database timestamps as local time", () => {
    const parsed = parseLoginTimestamp("2026-08-14 13:05:00");
    expect(parsed).toEqual(new Date(2026, 7, 14, 13, 5, 0));
  });

  test("formats a readable login time", () => {
    const value = "2026-08-14 13:05:00";
    expect(formatLoginTimestamp(value)).toBe(
      new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(2026, 7, 14, 13, 5, 0)),
    );
  });

  test("uses a safe fallback for invalid timestamps", () => {
    expect(parseLoginTimestamp("not-a-date")).toBeNull();
    expect(formatLoginTimestamp("")).toBe("Unknown time");
  });
});
