import { tickFetchNewMessages, tickFetchUnreadNotifications } from "./chatContextUtils";

test("returns the server polling cursor even when there are no new messages", async () => {
  jest.spyOn(global, "fetch").mockResolvedValue({
    ok: true,
    json: async () => ({ success: true, messages: [], cursor_ts: 1234 }),
  });

  await expect(tickFetchNewMessages(2, 1, 1200)).resolves.toMatchObject({
    messages: [],
    cursorTs: 1234,
  });
  jest.restoreAllMocks();
});

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
