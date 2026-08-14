import { tickFetchUnreadNotifications } from "./chatContextUtils";

describe("notification polling", () => {
  afterEach(() => jest.restoreAllMocks());

  test("returns ordered notification records and the server unread total", async () => {
    const notifications = [
      { notification_id: 9, type: "price_reduced", is_read: false },
      { notification_id: 7, type: "item_deleted", is_read: true },
    ];
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ notifications, unread_total: 1 }),
    });

    await expect(tickFetchUnreadNotifications()).resolves.toEqual({
      notifications,
      total: 1,
    });
  });

  test("uses safe defaults for malformed optional response fields", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ notifications: null, unread_total: "bad" }),
    });

    await expect(tickFetchUnreadNotifications()).resolves.toEqual({
      notifications: [],
      total: 0,
    });
  });
});
