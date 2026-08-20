import {
  getCardTone,
  getRequestState,
} from "../pages/ScheduledPurchases/utils/ongoingPurchaseViewUtils";
import {
  getScheduleBucket,
  groupScheduledPurchasesByItem,
} from "../pages/ScheduledPurchases/utils/scheduledPurchaseUtils";

describe("scheduled purchase architecture helpers", () => {
  test("status helpers prioritize confirm-state flags over raw status", () => {
    expect(getRequestState({ status: "accepted", has_completed_confirm: true })).toBe(
      "completed",
    );
    expect(
      getCardTone({ status: "accepted", has_unsuccessful_confirm: true }, true)
        .inactive,
    ).toBe(true);
  });

  test("bucket helper handles invalid and relative meeting states", () => {
    const now = Date.parse("2026-01-02T12:00:00Z");

    expect(getScheduleBucket({ status: "pending" }, now)).toBe("needsResponse");
    expect(
      getScheduleBucket(
        { status: "accepted", meeting_at: "2026-01-02T12:10:00Z" },
        now,
      ),
    ).toBe("upcoming");
    expect(
      getScheduleBucket(
        { status: "accepted", meeting_at: "2026-01-02T11:45:00Z" },
        now,
      ),
    ).toBe("active");
    expect(
      getScheduleBucket(
        { status: "accepted", meeting_at: "2026-01-02T12:00:00Z" },
        now,
      ),
    ).toBe("active");
    expect(
      getScheduleBucket(
        { status: "accepted", meeting_at: "2026-01-02T11:30:00Z" },
        now,
      ),
    ).toBe("past");
  });

  test("groups buyer and seller requests by item with perspective attached", () => {
    const groups = groupScheduledPurchasesByItem(
      [{ request_id: 1, inventory_product_id: 7, status: "pending", item: { title: "Lamp" } }],
      [{ request_id: 2, inventory_product_id: 7, status: "accepted", item: { title: "Lamp" } }],
      Date.parse("2026-01-02T12:00:00Z"),
    );

    expect(groups).toHaveLength(1);
    expect(groups[0].purchases.map((request) => request.perspective)).toEqual([
      "buyer",
      "seller",
    ]);
  });
});
