import {
  chatSendErrorMessage,
  tickFetchNewMessages,
  upsertMessage,
} from "../../context/chatContextUtils";

describe("chatSendErrorMessage", () => {
  it("keeps a readable server message such as a rate limit", () => {
    expect(
      chatSendErrorMessage(429, {
        error: "You are sending messages too quickly. Please wait a moment and try again.",
      }),
    ).toBe("You are sending messages too quickly. Please wait a moment and try again.");
  });

  it("keeps the closed-chat reason", () => {
    expect(
      chatSendErrorMessage(403, { error: "Item has been deleted. Cannot send messages." }),
    ).toBe("Item has been deleted. Cannot send messages.");
  });

  it("maps machine codes to sentences", () => {
    expect(chatSendErrorMessage(400, { error: "content_too_long" })).toBe(
      "Messages can be at most 500 characters.",
    );
    expect(chatSendErrorMessage(400, { error: "missing_image" })).toBe(
      "Choose a photo or video to send.",
    );
  });

  it("explains oversized uploads", () => {
    expect(chatSendErrorMessage(413, null)).toBe("That file is too large to send.");
  });

  it("falls back to a generic retry hint for opaque errors", () => {
    expect(chatSendErrorMessage(500, { error: "Server error" })).toBe(
      "Your message couldn't be sent. Please try again.",
    );
    expect(chatSendErrorMessage(502, null)).toBe(
      "Your message couldn't be sent. Please try again.",
    );
  });
});

describe("upsertMessage", () => {
  it("appends a new message", () => {
    expect(upsertMessage([{ message_id: 1 }], { message_id: 2 })).toEqual([
      { message_id: 1 },
      { message_id: 2 },
    ]);
  });

  it("replaces a message the poll already delivered instead of duplicating it", () => {
    const list = [{ message_id: 7, content: "from poll", sender: "me" }];
    const next = upsertMessage(list, { message_id: "7", content: "from POST" });
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ content: "from POST", sender: "me" });
  });

  it("handles an empty conversation", () => {
    expect(upsertMessage(undefined, { message_id: 3 })).toEqual([{ message_id: 3 }]);
  });
});

test("carries the sender's uncensored text for editing", async () => {
  jest.spyOn(global, "fetch").mockResolvedValue({
    ok: true,
    json: async () => ({
      success: true,
      cursor_ts: 10,
      messages: [
        {
          message_id: 5,
          sender_id: 1,
          content: "what the ****",
          raw_content: "what the heck",
          created_at: "2026-01-01T00:00:00Z",
        },
      ],
    }),
  });

  const { messages } = await tickFetchNewMessages(2, 1, 0);
  expect(messages[0]).toMatchObject({
    content: "what the ****",
    rawContent: "what the heck",
    sender: "me",
  });
  jest.restoreAllMocks();
});
