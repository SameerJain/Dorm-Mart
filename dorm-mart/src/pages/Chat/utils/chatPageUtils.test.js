import {
  buildDisplayMessages,
  parseChatMetadata,
} from "./chatPageUtils";

test("parses chat metadata safely", () => {
  expect(parseChatMetadata('{"type":"text"}')).toEqual({ type: "text" });
  expect(parseChatMetadata({ type: "text" })).toEqual({ type: "text" });
  expect(parseChatMetadata("bad json")).toBeNull();
});

test("replaces a confirm request with only its latest response", () => {
  const messages = [
    {
      message_id: 1,
      ts: 1,
      metadata: { type: "confirm_request", confirm_request_id: 9 },
    },
    {
      message_id: 2,
      ts: 2,
      metadata: { type: "confirm_denied", confirm_request_id: 9 },
    },
    {
      message_id: 3,
      ts: 3,
      metadata: { type: "confirm_accepted", confirm_request_id: 9 },
    },
  ];

  expect(
    buildDisplayMessages({
      messages,
      hasAcceptedConfirm: false,
    }).map((message) => message.message_id),
  ).toEqual([3]);
});

test("adds the appropriate review prompt after an accepted confirmation", () => {
  const result = buildDisplayMessages({
    messages: [
      {
        message_id: 3,
        ts: 10,
        metadata: { type: "confirm_accepted", confirm_request_id: 9 },
      },
    ],
    hasAcceptedConfirm: true,
    productId: 12,
    shouldShowReviewPrompt: true,
  });

  expect(result.map((message) => message.message_id)).toEqual([
    3,
    "review_prompt_12",
  ]);
});
