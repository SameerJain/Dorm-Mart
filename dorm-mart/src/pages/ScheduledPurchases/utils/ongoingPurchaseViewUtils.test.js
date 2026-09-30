import {
  BADGE_BASE,
  CARD_TONES,
  formatPersonName,
  formatPurchaseDateTime,
  getCardTone,
  getRequestState,
  getStatusBadgeClass,
  getStatusLabel,
} from "./ongoingPurchaseViewUtils";
import { formatDateTime } from "../../../utils/formatters";

// These check which style entry a request gets, not the CSS text inside it.

describe("getRequestState", () => {
  test("a failed exchange outranks a completed one, which outranks status", () => {
    expect(
      getRequestState({ status: "accepted", has_completed_confirm: true, has_unsuccessful_confirm: true }),
    ).toBe("unsuccessful");
    expect(getRequestState({ status: "accepted", has_completed_confirm: true })).toBe("completed");
    expect(getRequestState({ status: "accepted" })).toBe("accepted");
    expect(getRequestState({})).toBe("default");
  });
});

describe("getStatusLabel", () => {
  test.each([
    [{ status: "accepted", has_unsuccessful_confirm: true }, "Unsuccessful"],
    [{ status: "accepted", has_completed_confirm: true }, "Completed"],
    [{ status: "pending" }, "Pending"],
    [{ status: "cancelled" }, "Cancelled"],
  ])("%p is labelled %p", (req, label) => {
    expect(getStatusLabel(req)).toBe(label);
  });
});

describe("getStatusBadgeClass", () => {
  test("every badge starts from the shared base", () => {
    expect(getStatusBadgeClass({ status: "pending" }).startsWith(`${BADGE_BASE} `)).toBe(true);
  });

  test("known states get their own colour and unknown ones the default", () => {
    const pending = getStatusBadgeClass({ status: "pending" });
    const accepted = getStatusBadgeClass({ status: "accepted" });
    const fallback = getStatusBadgeClass({});
    expect(new Set([pending, accepted, fallback]).size).toBe(3);
    expect(getStatusBadgeClass({ status: "renegotiating" })).toBe(fallback);
    expect(getStatusBadgeClass({ status: "accepted", has_completed_confirm: true })).not.toBe(accepted);
  });
});

describe("getCardTone", () => {
  test.each([
    [{ status: "declined" }, "negative"],
    [{ status: "cancelled" }, "negative"],
    [{ status: "accepted", has_unsuccessful_confirm: true }, "negative"],
    [{ status: "expired" }, "expired"],
    [{ status: "accepted", has_completed_confirm: true }, "completed"],
  ])("%p uses the %s tone for either party", (req, tone) => {
    expect(getCardTone(req, true)).toBe(CARD_TONES[tone]);
    expect(getCardTone(req, false)).toBe(CARD_TONES[tone]);
  });

  test("closed cards are greyed out and only failed ones show the cost in red", () => {
    const flags = (name) => [!!CARD_TONES[name].inactive, !!CARD_TONES[name].redCost];
    expect(flags("negative")).toEqual([true, true]);
    expect(flags("expired")).toEqual([true, true]);
    expect(flags("completed")).toEqual([true, false]);
    expect(flags("buyer")).toEqual([false, false]);
    expect(flags("seller")).toEqual([false, false]);
  });

  test("open requests are coloured by the viewer's side", () => {
    expect(getCardTone({ status: "accepted" }, true)).toBe(CARD_TONES.buyer);
    expect(getCardTone({ status: "pending" }, false)).toBe(CARD_TONES.seller);
  });
});

describe("formatPersonName", () => {
  test("joins the parts that exist without stray spaces", () => {
    expect(formatPersonName({ first_name: "Ava", last_name: "Lee" })).toBe("Ava Lee");
    expect(formatPersonName({ first_name: "Ava" })).toBe("Ava");
    expect(formatPersonName({ last_name: "Lee" })).toBe("Lee");
    expect(formatPersonName(null)).toBe("");
  });
});

describe("formatPurchaseDateTime", () => {
  test("formats a value and leaves a missing one blank", () => {
    expect(formatPurchaseDateTime("2026-01-02T12:00:00Z")).toBe(formatDateTime("2026-01-02T12:00:00Z"));
    expect(formatPurchaseDateTime("2026-01-02T12:00:00Z")).not.toBe("");
    expect(formatPurchaseDateTime(null)).toBe("");
  });
});
