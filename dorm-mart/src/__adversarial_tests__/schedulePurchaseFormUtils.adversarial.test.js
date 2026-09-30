import {
  normalizeScheduleListing,
  resolveMeetLocation,
  validateNegotiatedPrice,
} from "../pages/ScheduledPurchases/utils/schedulePurchaseFormUtils";
import { getMaxDayForMeetingMonth } from "../pages/ScheduledPurchases/utils/scheduleDateTimeUtils";

describe("schedule purchase form utility boundaries", () => {
  test("normalizes listing booleans from mixed API shapes", () => {
    expect(
      normalizeScheduleListing({
        price_nego: "1",
        trades: "true",
      }),
    ).toEqual(
      expect.objectContaining({
        priceNegotiable: true,
        acceptTrades: true,
      }),
    );
    // Falsy and unrecognised values must come out false, not merely "not false".
    expect(
      normalizeScheduleListing({ price_nego: "maybe", trades: "0" }),
    ).toEqual(
      expect.objectContaining({ priceNegotiable: false, acceptTrades: false }),
    );
    // The camelCase field wins when both shapes are present and disagree.
    expect(
      normalizeScheduleListing({ priceNegotiable: false, price_nego: "1" })
        .priceNegotiable,
    ).toBe(false);
  });

  test("resolves custom meet location only for Other", () => {
    expect(resolveMeetLocation("Other", "  Student Union  ")).toBe(
      "Student Union",
    );
    expect(resolveMeetLocation("North Campus", "Student Union")).toBe(
      "North Campus",
    );
  });

  test("passes missing listings and blank meet locations through as null", () => {
    expect(normalizeScheduleListing(null)).toBeNull();
    expect(normalizeScheduleListing({ meet_location: "" }).meet_location).toBeNull();
    expect(normalizeScheduleListing({ meet_location: "Ellicott" }).meet_location).toBe("Ellicott");
  });

  test("accepts valid negotiated prices with no error", () => {
    expect(validateNegotiatedPrice("12.50")).toEqual({ value: 12.5, error: "" });
    expect(validateNegotiatedPrice("  12.50  ")).toEqual({ value: 12.5, error: "" });
    expect(validateNegotiatedPrice("   ")).toEqual({ value: null, error: "" });
    // The ceiling itself is allowed; only amounts above it are rejected.
    expect(validateNegotiatedPrice("9999.99")).toEqual({ value: 9999.99, error: "" });
    // Only the literal digits count as a meme: $4.20 is not "420".
    expect(validateNegotiatedPrice("4.20")).toEqual({ value: 4.2, error: "" });
  });

  test("rejects invalid negotiated prices with explicit reasons", () => {
    expect(validateNegotiatedPrice("420").error).toMatch(/meme input/);
    expect(validateNegotiatedPrice("10", { isTrade: true }).error).toMatch(
      /Cannot enter a price/,
    );
    expect(validateNegotiatedPrice("10000").error).toMatch(/9999.99/);
    expect(validateNegotiatedPrice("1abc").error).toMatch(/valid price/);
    expect(validateNegotiatedPrice("1e3").error).toMatch(/valid price/);
    expect(validateNegotiatedPrice("1.999").error).toMatch(/valid price/);
  });

  test("calculates month day limits without component-local date math", () => {
    const leapYear = new Date(2024, 0, 15);
    const commonYear = new Date(2025, 0, 15);

    expect(getMaxDayForMeetingMonth("02", leapYear)).toBe(29);
    expect(getMaxDayForMeetingMonth("02", commonYear)).toBe(28);
    expect(getMaxDayForMeetingMonth("13", commonYear)).toBe(31);
  });
});
