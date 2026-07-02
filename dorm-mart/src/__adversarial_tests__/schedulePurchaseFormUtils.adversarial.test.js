import {
  normalizeScheduleListing,
  resolveMeetLocation,
  validateNegotiatedPrice,
} from "../pages/ScheduledPurchases/utils/schedulePurchaseFormUtils";

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
  });

  test("resolves custom meet location only for Other", () => {
    expect(resolveMeetLocation("Other", "  Student Union  ")).toBe(
      "Student Union",
    );
    expect(resolveMeetLocation("North Campus", "Student Union")).toBe(
      "North Campus",
    );
  });

  test("rejects invalid negotiated prices with explicit reasons", () => {
    expect(validateNegotiatedPrice("12.50").value).toBe(12.5);
    expect(validateNegotiatedPrice("420").error).toMatch(/meme input/);
    expect(validateNegotiatedPrice("10", { isTrade: true }).error).toMatch(
      /Cannot enter a price/,
    );
    expect(validateNegotiatedPrice("10000").error).toMatch(/9999.99/);
  });
});
