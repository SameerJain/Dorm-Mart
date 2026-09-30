import {
  compareItemGroups,
  getScheduleBucket,
  groupScheduledPurchasesByItem,
  loadScheduledPurchases,
  partitionAndSortPurchases,
} from "./scheduledPurchaseUtils";
import { apiGetJson } from "../../../utils/apiClient";

jest.mock("../../../utils/apiClient", () => ({ apiGetJson: jest.fn() }));

const NOW = Date.parse("2026-01-02T12:00:00Z");
const at = (time) => `2026-01-02T${time}:00Z`;
const ids = (list) => list.map((req) => req.request_id);

describe("getScheduleBucket", () => {
  test.each(["declined", "cancelled", "expired"])(
    "a %s request is past even before its meeting",
    (status) => {
      expect(getScheduleBucket({ status, meeting_at: at("14:00") }, NOW)).toBe("past");
    },
  );

  test("a confirmed or failed exchange is past even before its meeting", () => {
    const upcoming = { status: "accepted", meeting_at: at("14:00") };
    expect(getScheduleBucket({ ...upcoming, has_completed_confirm: true }, NOW)).toBe("past");
    expect(getScheduleBucket({ ...upcoming, has_unsuccessful_confirm: true }, NOW)).toBe("past");
    expect(getScheduleBucket(upcoming, NOW)).toBe("upcoming");
  });

  test("stays active until exactly 30 minutes after the meeting", () => {
    expect(getScheduleBucket({ status: "accepted", meeting_at: "2026-01-02T11:30:01Z" }, NOW)).toBe(
      "active",
    );
    expect(getScheduleBucket({ status: "accepted", meeting_at: at("11:30") }, NOW)).toBe("past");
  });

  test("only a pending request with no meeting time needs a response", () => {
    expect(getScheduleBucket({ status: "pending", meeting_at: at("14:00") }, NOW)).toBe("upcoming");
    expect(getScheduleBucket({ status: "accepted" }, NOW)).toBe("upcoming");
  });
});

describe("partitionAndSortPurchases", () => {
  // Inputs are shuffled so that leaving a bucket unsorted, or sorting it the
  // wrong way, changes the result.
  const purchases = [
    { request_id: "past-created-9", status: "expired", created_at: at("09:00") },
    { request_id: "up-none", status: "accepted" },
    { request_id: "active-1150", status: "accepted", meeting_at: at("11:50") },
    { request_id: "past-met-10", status: "declined", meeting_at: "2026-01-01T10:00:00Z" },
    { request_id: "needs-8", status: "pending", created_at: at("08:00") },
    { request_id: "up-14", status: "accepted", meeting_at: at("14:00") },
    { request_id: "past-created-11", status: "declined", created_at: at("11:00") },
    { request_id: "active-1140", status: "accepted", meeting_at: at("11:40") },
    { request_id: "needs-10", status: "pending", created_at: at("10:00") },
    { request_id: "up-13", status: "accepted", meeting_at: at("13:00") },
    { request_id: "past-met-15", status: "cancelled", meeting_at: "2026-01-01T15:00:00Z" },
    // Third entries: with two items, some wrong comparators still land on the
    // right order by luck.
    { request_id: "active-1145", status: "accepted", meeting_at: at("11:45") },
    { request_id: "past-met-12", status: "declined", meeting_at: "2026-01-01T12:00:00Z" },
  ];
  const buckets = partitionAndSortPurchases(purchases, NOW);

  test("active: earliest meeting first", () => {
    expect(ids(buckets.active)).toEqual(["active-1140", "active-1145", "active-1150"]);
  });

  test("needs response: newest request first", () => {
    expect(ids(buckets.needsResponse)).toEqual(["needs-10", "needs-8"]);
  });

  test("upcoming: earliest meeting first, unscheduled last", () => {
    expect(ids(buckets.upcoming)).toEqual(["up-13", "up-14", "up-none"]);
  });

  test("past: latest meeting first, then unscheduled by newest request", () => {
    expect(ids(buckets.past)).toEqual([
      "past-met-15",
      "past-met-12",
      "past-met-10",
      "past-created-11",
      "past-created-9",
    ]);
  });
});

describe("groupScheduledPurchasesByItem", () => {
  const order = (groups) => groups.map((group) => group.productId);

  test("orders items by their most urgent request, then by that bucket's own rule", () => {
    const buyer = [
      { request_id: 1, inventory_product_id: 10, status: "declined", meeting_at: "2026-01-01T10:00:00Z" },
      { request_id: 2, inventory_product_id: 11, status: "accepted", meeting_at: at("14:00") },
      { request_id: 3, inventory_product_id: 12, status: "accepted", meeting_at: at("13:00") },
      { request_id: 4, inventory_product_id: 13, status: "pending", created_at: at("08:00") },
    ];
    const seller = [
      { request_id: 5, inventory_product_id: 14, status: "pending", created_at: at("10:00") },
      { request_id: 6, inventory_product_id: 15, status: "accepted", meeting_at: at("11:50") },
      { request_id: 7, inventory_product_id: 16, status: "accepted", meeting_at: at("11:40") },
      { request_id: 8, inventory_product_id: 17, status: "cancelled", meeting_at: "2026-01-01T15:00:00Z" },
      { request_id: 9, inventory_product_id: 18, status: "declined", created_at: "2026-01-01T20:00:00Z" },
    ];

    expect(order(groupScheduledPurchasesByItem(buyer, seller, NOW))).toEqual([
      16, 15, // active, earliest meeting first
      14, 13, // needs response, newest request first
      12, 11, // upcoming, earliest meeting first
      18, 17, 10, // past, latest meeting (or request) first
    ]);
  });

  test("an item's best bucket decides its place, not its first request", () => {
    const groups = groupScheduledPurchasesByItem(
      [
        { request_id: 1, inventory_product_id: 1, status: "accepted", meeting_at: at("13:00") },
        { request_id: 2, inventory_product_id: 2, status: "declined" },
        { request_id: 3, inventory_product_id: 2, status: "accepted", meeting_at: at("11:45") },
      ],
      [],
      NOW,
    );
    expect(order(groups)).toEqual([2, 1]);
  });

  test("sorting overrides the ascending-id order that grouping produces", () => {
    // Items are grouped through an object keyed on product id, so they come out
    // in ascending id order before sorting; the id tie-break is therefore
    // tested through compareItemGroups directly below.
    const groups = groupScheduledPurchasesByItem(
      [
        { request_id: 1, inventory_product_id: 2, status: "accepted", meeting_at: at("14:00") },
        { request_id: 2, inventory_product_id: 1, status: "accepted", meeting_at: at("15:00") },
      ],
      [],
      NOW,
    );
    expect(order(groups)).toEqual([2, 1]);
  });

  test("ties break by newest request, then by product id in numeric order", () => {
    const upcoming = { status: "accepted", meeting_at: at("13:00") };
    const groups = groupScheduledPurchasesByItem(
      [
        { ...upcoming, request_id: 1, inventory_product_id: 10, created_at: at("09:00") },
        { ...upcoming, request_id: 2, inventory_product_id: 9, created_at: at("09:00") },
        { ...upcoming, request_id: 3, inventory_product_id: 19, created_at: at("09:00") },
        { ...upcoming, request_id: 4, inventory_product_id: 20, created_at: at("11:00") },
      ],
      [],
      NOW,
    );
    expect(order(groups)).toEqual([20, 9, 10, 19]);
  });

  test("tags perspective and falls back to a placeholder item", () => {
    const [group] = groupScheduledPurchasesByItem(
      [{ request_id: 1, inventory_product_id: 7, status: "pending" }],
      [{ request_id: 2, inventory_product_id: 7, status: "accepted", item: { title: "Lamp" } }],
      NOW,
    );
    expect(group.item).toEqual({ title: "Unknown Item" });
    expect(group.purchases.map((req) => [req.request_id, req.perspective])).toEqual([
      [1, "buyer"],
      [2, "seller"],
    ]);
  });
});

describe("compareItemGroups", () => {
  let nextId = 1;
  const group = (productId, requests) => ({
    productId,
    buckets: partitionAndSortPurchases(
      requests.map((req) => ({ request_id: nextId++, ...req })),
      NOW,
    ),
  });
  const accepted = (time, created = at("00:00")) => ({ status: "accepted", meeting_at: at(time), created_at: created });
  const pending = (created) => ({ status: "pending", created_at: created });
  const pastMeeting = (dayTime) => ({ status: "declined", meeting_at: `2026-01-01T${dayTime}:00Z` });
  // Negative: a sorts first. Positive: b sorts first.
  const sign = (a, b) => Math.sign(compareItemGroups(a, b));

  // Each "several" group has a request on either side of the single-request
  // group, so comparing by the wrong end (min vs max) flips the result.
  test("active: the item with the earliest meeting wins", () => {
    const several = group(1, [accepted("11:40"), accepted("11:55")]);
    const single = group(2, [accepted("11:50")]);
    expect(sign(several, single)).toBe(-1);
    expect(sign(single, several)).toBe(1);
  });

  test("needs response: the item with the newest request wins", () => {
    const several = group(1, [pending(at("08:00")), pending(at("10:30"))]);
    const single = group(2, [pending(at("10:00"))]);
    expect(sign(several, single)).toBe(-1);
    expect(sign(single, several)).toBe(1);
  });

  test("needs response is judged by pending requests only, not the item's other history", () => {
    const olderPendingNewerHistory = group(1, [
      pending(at("08:00")),
      { status: "declined", created_at: at("11:00") },
    ]);
    const newerPending = group(2, [pending(at("10:00"))]);
    expect(sign(newerPending, olderPendingNewerHistory)).toBe(-1);
  });

  test("upcoming: the item with the earliest meeting wins", () => {
    const several = group(1, [accepted("13:00"), accepted("15:00")]);
    const single = group(2, [accepted("14:00")]);
    expect(sign(several, single)).toBe(-1);
    expect(sign(single, several)).toBe(1);
  });

  test("past: the item with the latest meeting wins", () => {
    const several = group(1, [pastMeeting("10:00"), pastMeeting("16:00")]);
    const single = group(2, [pastMeeting("15:00")]);
    expect(sign(several, single)).toBe(-1);
    expect(sign(single, several)).toBe(1);
  });

  test("equal bucket times fall back to the newest request, then product id", () => {
    const olderRequest = group(1, [accepted("11:40", at("09:00"))]);
    const newerRequest = group(2, [accepted("11:40", at("11:00"))]);
    expect(sign(newerRequest, olderRequest)).toBe(-1);

    // Same for tied needs-response and past items: the item with other, newer
    // history goes first.
    const pendingWithHistory = group(3, [pending(at("10:00")), { status: "declined", created_at: at("11:30") }]);
    const pendingOnly = group(4, [pending(at("10:00"))]);
    expect(sign(pendingWithHistory, pendingOnly)).toBe(-1);
    // Both items' latest past key is the Jan 1 15:00 meeting; only the older,
    // unscheduled request tells them apart.
    const pastWithOlderRequest = group(5, [pastMeeting("15:00"), { status: "declined", created_at: "2026-01-01T10:00:00Z" }]);
    const pastOnly = group(6, [pastMeeting("15:00")]);
    expect(sign(pastWithOlderRequest, pastOnly)).toBe(-1);

    const nine = group(9, [accepted("13:00", at("09:00"))]);
    const ten = group(10, [accepted("13:00", at("09:00"))]);
    expect(sign(nine, ten)).toBe(-1);
    expect(sign(ten, nine)).toBe(1);
  });
});

describe("loadScheduledPurchases", () => {
  beforeEach(() => apiGetJson.mockReset());

  test("loads buyer and seller lists with the caller's abort signal", async () => {
    apiGetJson.mockImplementation(async (url) =>
      url.endsWith("list_buyer.php")
        ? { success: true, data: [{ request_id: 1 }] }
        : { success: true, data: "not a list" },
    );
    const signal = new AbortController().signal;

    await expect(loadScheduledPurchases(signal)).resolves.toEqual({
      buyerRequests: [{ request_id: 1 }],
      sellerRequests: [],
    });
    expect(apiGetJson).toHaveBeenCalledWith(
      expect.stringMatching(/\/scheduled_purchases\/list_buyer\.php$/),
      { signal },
    );
    expect(apiGetJson).toHaveBeenCalledWith(
      expect.stringMatching(/\/scheduled_purchases\/list_seller\.php$/),
      { signal },
    );
  });

  test("surfaces the server's error, or a default one", async () => {
    apiGetJson.mockResolvedValue({ success: false, error: "Session expired" });
    await expect(loadScheduledPurchases()).rejects.toThrow("Session expired");

    apiGetJson.mockResolvedValue(null);
    await expect(loadScheduledPurchases()).rejects.toThrow("Failed to load scheduled purchases");
  });
});
