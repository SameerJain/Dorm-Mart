import {
  chatSendErrorMessage,
  createImageMessageApi,
  createMessageApi,
  deleteMessageApi,
  editLastMessageApi,
  envBool,
  fetchConversationApi,
  fetchConversations,
  fetchNewMessages,
  fetchUnreadMessages,
  fetchUnreadNotifications,
  tickFetchNewMessages,
  tickFetchUnreadMessages,
  upsertMessage,
} from "./chatContextUtils";
import { csrfFetch } from "../utils/csrfFetch";
import logger from "../utils/logger";

jest.mock("../utils/csrfFetch", () => ({ csrfFetch: jest.fn() }));
jest.mock("../utils/logger", () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

const ok = (body) => ({ ok: true, status: 200, json: async () => body });
const fail = (status, body) => ({ ok: false, status, json: async () => body });

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn();
});

describe("polling requests", () => {
  test.each([
    ["fetchConversations", () => fetchConversations(), /\/chat\/fetch_conversations\.php$/],
    ["fetchConversationApi", () => fetchConversationApi(42), /\/chat\/fetch_conversation\.php\?conv_id=42$/],
    ["fetchNewMessages", () => fetchNewMessages(42, 1700), /\/chat\/fetch_new_messages\.php\?conv_id=42&ts=1700$/],
    ["fetchUnreadMessages", () => fetchUnreadMessages(), /\/chat\/fetch_unread_messages\.php$/],
    [
      "fetchUnreadNotifications",
      () => fetchUnreadNotifications(),
      /\/wishlist\/fetch_unread_notifications\.php$/,
    ],
  ])("%s calls the right endpoint with the session cookie", async (_name, call, url) => {
    global.fetch.mockResolvedValue(ok({ success: true }));
    const signal = new AbortController().signal;
    await call();
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [calledUrl, options] = global.fetch.mock.calls[0];
    expect(calledUrl).toMatch(url);
    expect(options).toMatchObject({
      method: "GET",
      headers: { Accept: "application/json" },
      credentials: "include",
    });
    expect(signal).toBeDefined();
  });

  test("the abort signal reaches fetch", async () => {
    global.fetch.mockResolvedValue(ok({}));
    const signal = new AbortController().signal;
    await fetchConversations(signal);
    expect(global.fetch.mock.calls[0][1].signal).toBe(signal);
  });

  test("a failed poll rejects with its HTTP status", async () => {
    global.fetch.mockResolvedValue(fail(503, {}));
    await expect(fetchConversations()).rejects.toThrow("HTTP 503");
  });
});

describe("editLastMessageApi and deleteMessageApi", () => {
  test("edit posts the message id and new text, and returns the updated message", async () => {
    csrfFetch.mockResolvedValue(ok({ success: true, message: { message_id: 5, content: "new" } }));
    await expect(editLastMessageApi(5, "new")).resolves.toEqual({ message_id: 5, content: "new" });
    const [url, options] = csrfFetch.mock.calls[0];
    expect(url).toMatch(/\/chat\/edit_last_message\.php$/);
    expect(options).toMatchObject({ method: "POST", credentials: "include" });
    expect(options.headers).toEqual({ "Content-Type": "application/json", Accept: "application/json" });
    expect(JSON.parse(options.body)).toEqual({ message_id: 5, content: "new" });
  });

  test("delete posts only the message id and returns the response", async () => {
    csrfFetch.mockResolvedValue(ok({ success: true, message_id: 5 }));
    await expect(deleteMessageApi(5)).resolves.toEqual({ success: true, message_id: 5 });
    const [url, options] = csrfFetch.mock.calls[0];
    expect(url).toMatch(/\/chat\/delete_message\.php$/);
    expect(options).toMatchObject({ method: "POST", credentials: "include" });
    expect(options.headers).toEqual({ "Content-Type": "application/json", Accept: "application/json" });
    expect(JSON.parse(options.body)).toEqual({ message_id: 5 });
  });

  test.each([
    ["edit", () => editLastMessageApi(5, "x"), "Unable to edit message"],
    ["delete", () => deleteMessageApi(5), "Unable to delete message"],
  ])("%s surfaces the server's reason, or a default", async (_name, call, fallback) => {
    csrfFetch.mockResolvedValue(fail(409, { success: false, error: "Message is locked" }));
    await expect(call()).rejects.toThrow("Message is locked");

    csrfFetch.mockResolvedValue({ ok: false, status: 500, json: async () => { throw new Error("not json"); } });
    await expect(call()).rejects.toThrow(fallback);

    // HTTP 200 with success:false is still a failure.
    csrfFetch.mockResolvedValue(ok({ success: false }));
    await expect(call()).rejects.toThrow(fallback);

    // HTTP error with success:true in the body is still a failure.
    csrfFetch.mockResolvedValue(fail(500, { success: true }));
    await expect(call()).rejects.toThrow(fallback);

    // HTTP 200 whose body is not JSON: the deliberate error, not a TypeError.
    csrfFetch.mockResolvedValue({ ok: true, status: 200, json: async () => { throw new Error("html"); } });
    await expect(call()).rejects.toThrow(fallback);
  });
});

describe("createMessageApi", () => {
  test("posts the receiver and text, adding the conversation only when known", async () => {
    csrfFetch.mockResolvedValue(ok({ success: true }));
    const signal = new AbortController().signal;

    await createMessageApi({ receiverId: 3, convId: 9, content: "hi", signal });
    const [url, options] = csrfFetch.mock.calls[0];
    expect(url).toMatch(/\/chat\/create_message\.php$/);
    expect(options).toMatchObject({ method: "POST", credentials: "include", signal });
    expect(options.headers).toEqual({ "Content-Type": "application/json", Accept: "application/json" });
    expect(JSON.parse(options.body)).toEqual({ receiver_id: 3, content: "hi", conv_id: 9 });

    await createMessageApi({ receiverId: 3, content: "hi" });
    expect(JSON.parse(csrfFetch.mock.calls[1][1].body)).toEqual({ receiver_id: 3, content: "hi" });
  });

  test("returns the parsed response", async () => {
    csrfFetch.mockResolvedValue(ok({ success: true, message: { message_id: 1 } }));
    await expect(createMessageApi({ receiverId: 3, content: "hi" })).resolves.toEqual({
      success: true,
      message: { message_id: 1 },
    });
  });

  test("a rejected send throws the friendly message and keeps the status", async () => {
    csrfFetch.mockResolvedValue(fail(400, { error: "content_too_long" }));
    await expect(createMessageApi({ receiverId: 3, content: "x" })).rejects.toMatchObject({
      message: chatSendErrorMessage(400, { error: "content_too_long" }),
      status: 400,
    });
    expect(chatSendErrorMessage(400, { error: "content_too_long" })).toBe("Messages can be at most 500 characters.");

    // An unreadable error body still produces the generic message.
    csrfFetch.mockResolvedValue({ ok: false, status: 502, json: async () => { throw new Error("html"); } });
    await expect(createMessageApi({ receiverId: 3, content: "x" })).rejects.toMatchObject({
      message: "Your message couldn't be sent. Please try again.",
      status: 502,
    });
  });
});

describe("createImageMessageApi", () => {
  const image = new File(["bits"], "lamp.png", { type: "image/png" });

  test("uploads multipart form data without forcing a content type", async () => {
    csrfFetch.mockResolvedValue(ok({ success: true }));
    const signal = new AbortController().signal;
    await createImageMessageApi({ receiverId: 3, convId: 9, content: "look", image, signal });

    const [url, options] = csrfFetch.mock.calls[0];
    expect(url).toMatch(/\/chat\/create_image_message\.php$/);
    expect(options).toMatchObject({ method: "POST", credentials: "include", signal });
    expect(options.headers).toBeUndefined();
    expect(options.body).toBeInstanceOf(FormData);
    expect(options.body.get("receiver_id")).toBe("3");
    expect(options.body.get("conv_id")).toBe("9");
    expect(options.body.get("content")).toBe("look");
    expect(options.body.get("image").name).toBe("lamp.png");
  });

  test("leaves out the conversation when unknown and sends an empty caption", async () => {
    csrfFetch.mockResolvedValue(ok({ success: true }));
    await createImageMessageApi({ receiverId: 3, image });
    const body = csrfFetch.mock.calls[0][1].body;
    expect(body.has("conv_id")).toBe(false);
    expect(body.get("content")).toBe("");
  });

  test("a rejected upload throws the friendly message and keeps the status", async () => {
    csrfFetch.mockResolvedValue(fail(413, null));
    await expect(createImageMessageApi({ receiverId: 3, image })).rejects.toMatchObject({
      message: "That file is too large to send.",
      status: 413,
    });
  });
});

describe("chatSendErrorMessage", () => {
  test.each([
    ["missing_fields", "Type a message before sending."],
    ["missing_image", "Choose a photo or video to send."],
    ["content_too_long", "Messages can be at most 500 characters."],
    ["file_too_large", "That file is too large to send. Videos can be up to 25 MB."],
    ["image_too_large", "Photos can be up to 2 MB."],
    ["unsupported_type", "That file type isn't supported. Send a JPG, PNG, WebP, MP4, WebM, or MOV file."],
  ])("maps the code %s", (code, message) => {
    expect(chatSendErrorMessage(400, { error: code })).toBe(message);
    expect(chatSendErrorMessage(400, { error: `  ${code}  ` })).toBe(message);
  });

  test("a rate limit without a readable message gets the generic one", () => {
    const generic = "You're sending messages too quickly. Wait a moment and try again.";
    expect(chatSendErrorMessage(429, { error: "rate_limited" })).toBe(generic);
    expect(chatSendErrorMessage(429, null)).toBe(generic);
    expect(chatSendErrorMessage(429, {})).toBe(generic);
  });

  test("offline and unreadable errors", () => {
    expect(chatSendErrorMessage(0, null)).toBe("You appear to be offline. Your message was not sent.");
    expect(chatSendErrorMessage(0, { error: "Server error" })).toBe(
      "You appear to be offline. Your message was not sent.",
    );
    expect(chatSendErrorMessage(500, { error: 12 })).toBe("Your message couldn't be sent. Please try again.");
    // A readable server sentence is kept for any other status.
    expect(chatSendErrorMessage(403, { error: "Item has been deleted." })).toBe("Item has been deleted.");
    // A one-word code is not a sentence.
    expect(chatSendErrorMessage(500, { error: "oops" })).toBe("Your message couldn't be sent. Please try again.");
  });
});

describe("tickFetchNewMessages", () => {
  const reply = (body) => global.fetch.mockResolvedValue(ok(body));

  test("normalizes messages, senders, timestamps, images and optional fields", async () => {
    reply({
      cursor_ts: "77",
      messages: [
        {
          message_id: 1,
          sender_id: "5",
          content: "mine",
          created_at: "2026-01-01T10:00:00Z",
          edited_at: "2026-01-01T10:05:00Z",
          deleted_at: "2026-01-01T10:10:00Z",
          activity_at: "2026-01-01T10:20:00Z",
          metadata: { card: "x" },
          image_url: "/img/a.png",
          raw_content: "mine raw",
        },
        { message_id: 2, sender_id: 6, created_at: "2026-01-01T11:00:00Z", metadata: '{"k":1}', image_path: "/img/b.png" },
        { message_id: 3, sender_id: 6, created_at: "2026-01-01T12:00:00Z", metadata: "{not json", imagePath: "/img/c.png" },
        { message_id: 4, sender_id: 0, content: null, created_at: "2026-01-01T13:00:00Z", edited_at: "2026-01-01T13:30:00Z" },
        { message_id: 5, sender_id: "x", created_at: "2026-01-01T14:00:00Z", raw_content: 12 },
        { message_id: 6, sender_id: -5, created_at: "2026-01-01T15:00:00Z", metadata: "" },
      ],
    });

    const { messages, cursorTs } = await tickFetchNewMessages(2, 5, 0);
    expect(cursorTs).toBe(77);
    expect(messages).toHaveLength(6);

    expect(messages[0]).toEqual({
      message_id: 1,
      sender: "me",
      content: "mine",
      ts: Date.parse("2026-01-01T10:00:00Z"),
      editedAt: Date.parse("2026-01-01T10:05:00Z"),
      deletedAt: Date.parse("2026-01-01T10:10:00Z"),
      activityTs: Date.parse("2026-01-01T10:20:00Z"),
      metadata: { card: "x" },
      image_url: "/img/a.png",
      rawContent: "mine raw",
    });

    // Other people's messages, JSON-string metadata, and the alternate image keys.
    expect(messages[1]).toMatchObject({ sender: "them", metadata: { k: 1 }, image_url: "/img/b.png", content: "" });
    expect(messages[1].editedAt).toBeNull();
    expect(messages[1].deletedAt).toBeNull();
    expect(messages[1]).not.toHaveProperty("rawContent");
    expect(messages[2]).toMatchObject({ sender: "them", metadata: null, image_url: "/img/c.png" });

    // A missing or invalid sender is never "me"; content defaults to "".
    expect(messages[3]).toMatchObject({ sender: "them", content: "" });
    expect(messages[3].activityTs).toBe(Date.parse("2026-01-01T13:30:00Z"));
    expect(messages[4].sender).toBe("them");
    expect(messages[5].sender).toBe("them");
    expect(messages[5].metadata).toBeNull();

    // Only present fields are added.
    expect(messages[2]).not.toHaveProperty("rawContent");
    expect(messages[3]).not.toHaveProperty("image_url");
    expect(messages[4]).not.toHaveProperty("rawContent");
  });

  test("defaults typing status, cursor and listing status when absent", async () => {
    reply({ messages: [] });
    await expect(tickFetchNewMessages(2, 5, 0)).resolves.toEqual({
      messages: [],
      typingStatus: { is_typing: false, typing_user_first_name: null },
      cursorTs: 0,
      conversationStatus: null,
    });
    reply(null);
    await expect(tickFetchNewMessages(2, 5, 0)).resolves.toMatchObject({ messages: [], cursorTs: 0 });
  });

  test("passes typing and listing status through", async () => {
    reply({
      messages: [],
      typing_status: { is_typing: true, typing_user_first_name: "Ava" },
      conversation_status: { product_status: "", item_deleted: 1 },
    });
    await expect(tickFetchNewMessages(2, 5, 0)).resolves.toMatchObject({
      typingStatus: { is_typing: true, typing_user_first_name: "Ava" },
      conversationStatus: { productStatus: null, itemDeleted: true },
    });
  });

  test("refuses to label senders without a valid own id, but keeps typing and cursor", async () => {
    reply({
      cursor_ts: 9,
      typing_status: { is_typing: true, typing_user_first_name: "Ava" },
      messages: [{ message_id: 1, sender_id: 5, created_at: "2026-01-01T10:00:00Z" }],
    });
    for (const badId of [0, -1, 1.5, "abc", null, undefined]) {
      logger.error.mockClear();
      await expect(tickFetchNewMessages(2, badId, 0)).resolves.toEqual({
        messages: [],
        typingStatus: { is_typing: true, typing_user_first_name: "Ava" },
        cursorTs: 9,
        conversationStatus: null,
      });
      expect(logger.error).toHaveBeenCalledTimes(1);
    }
  });

  test("asks for messages after the given timestamp", async () => {
    reply({ messages: [] });
    await tickFetchNewMessages(42, 5, 1700);
    expect(global.fetch.mock.calls[0][0]).toMatch(/fetch_new_messages\.php\?conv_id=42&ts=1700$/);
  });
});

describe("tickFetchUnreadMessages", () => {
  test("builds per-conversation counts and a total, skipping unusable rows", async () => {
    global.fetch.mockResolvedValue(
      ok({
        unreads: [
          { conv_id: "3", unread_count: "2" },
          { conv_id: 4, unread_count: 5 },
          { conv_id: 0, unread_count: 9 },
          { conv_id: -1, unread_count: 9 },
          { conv_id: 6, unread_count: 0 },
          { conv_id: 7, unread_count: -3 },
          { conv_id: 8, unread_count: "many" },
          { conv_id: "x", unread_count: 4 },
        ],
      }),
    );
    await expect(tickFetchUnreadMessages()).resolves.toEqual({ unreads: { 3: 2, 4: 5 }, total: 7 });
  });

  test("no unreads is an empty result", async () => {
    global.fetch.mockResolvedValue(ok({}));
    await expect(tickFetchUnreadMessages()).resolves.toEqual({ unreads: {}, total: 0 });
  });
});

describe("upsertMessage", () => {
  test("keeps a message without a usable id instead of merging it", () => {
    const list = [{ message_id: 0, content: "zero" }, { content: "no id" }];
    expect(upsertMessage(list, { content: "x" })).toEqual([...list, { content: "x" }]);
    expect(upsertMessage(list, undefined)).toEqual([...list, undefined]);
    expect(upsertMessage(list, { message_id: "abc" })).toHaveLength(3);
  });

  test("merges by numeric id at any position, without mutating the input", () => {
    const list = [{ message_id: 1, a: 1 }, { message_id: 2, a: 2 }, { message_id: 3, a: 3 }];
    const snapshot = JSON.parse(JSON.stringify(list));
    const next = upsertMessage(list, { message_id: 2, b: 9 });
    expect(next).toEqual([{ message_id: 1, a: 1 }, { message_id: 2, a: 2, b: 9 }, { message_id: 3, a: 3 }]);
    expect(list).toEqual(snapshot);
    expect(next).not.toBe(list);
    expect(upsertMessage(list, { message_id: 3 })[2]).toEqual({ message_id: 3, a: 3 });
  });
});

describe("envBool", () => {
  test.each([
    ["true", false, true],
    [" TRUE ", false, true],
    ["False", true, false],
    ["false", true, false],
    ["yes", true, true],
    ["yes", false, false],
    ["", true, true],
    [undefined, true, true],
    [null, true, true],
  ])("envBool(%p, %p) is %p", (value, fallback, expected) => {
    expect(envBool(value, fallback)).toBe(expected);
  });

  test("the fallback defaults to false", () => {
    expect(envBool(undefined)).toBe(false);
    expect(envBool("maybe")).toBe(false);
  });
});
