import fmtTime, {
  buildDisplayMessages,
  parseChatMetadata,
} from "../../../../pages/Chat/utils/chatPageUtils";

test("parses chat metadata safely", () => {
  expect(parseChatMetadata('{"type":"text"}')).toEqual({ type: "text" });
  expect(parseChatMetadata({ type: "text" })).toEqual({ type: "text" });
  expect(parseChatMetadata("bad json")).toBeNull();
});

test("missing chat metadata is null, not undefined or an empty value", () => {
  for (const value of [null, undefined, "", 0, false]) {
    expect(parseChatMetadata(value)).toBeNull();
  }
  const object = { type: "text" };
  expect(parseChatMetadata(object)).toBe(object);
});

describe("fmtTime", () => {
  // Local-time dates throughout: the function compares calendar days in the
  // viewer's own zone, so these hold wherever the tests run.
  const NOW = new Date(2026, 8, 30, 15, 45, 0); // Sept 30 2026, 3:45 PM local
  beforeEach(() => {
    jest.useFakeTimers("modern");
    jest.setSystemTime(NOW);
  });
  afterEach(() => jest.useRealTimers());

  test("today shows just the time", () => {
    const text = fmtTime(new Date(2026, 8, 30, 9, 5).getTime());
    expect(text).toMatch(/^0?9:05\s?AM$/i);
    expect(fmtTime(new Date(2026, 8, 30, 0, 0).getTime())).toMatch(/^12:00\s?AM$/i);
    expect(fmtTime(new Date(2026, 8, 30, 23, 59).getTime())).toMatch(/^11:59\s?PM$/i);
  });

  test("yesterday is labelled, with the time", () => {
    expect(fmtTime(new Date(2026, 8, 29, 18, 30).getTime())).toMatch(/^yesterday 0?6:30\s?PM$/i);
    expect(fmtTime(new Date(2026, 8, 29, 0, 1).getTime())).toMatch(/^yesterday 12:01\s?AM$/i);
  });

  test("yesterday works across a month boundary", () => {
    jest.setSystemTime(new Date(2026, 9, 1, 8, 0));
    expect(fmtTime(new Date(2026, 8, 30, 20, 0).getTime())).toMatch(/^yesterday 0?8:00\s?PM$/i);
  });

  test("older messages show the full date and time", () => {
    const text = fmtTime(new Date(2026, 8, 28, 14, 7).getTime());
    expect(text).not.toMatch(/yesterday/i);
    expect(text).toContain("2026");
    expect(text).toMatch(/09.28.2026|28.09.2026|2026.09.28/);
    expect(text).toMatch(/0?2:07\s?PM/i);
    // Same day, different year, is not "today".
    expect(fmtTime(new Date(2025, 8, 30, 15, 45).getTime())).toContain("2025");
    // Same day and month, different year, and the reverse: other months.
    expect(fmtTime(new Date(2026, 7, 30, 15, 45).getTime())).not.toMatch(/yesterday/i);
    expect(fmtTime(new Date(2026, 7, 30, 15, 45).getTime())).toMatch(/08.30.2026|30.08.2026|2026.08.30/);
  });
});

describe("buildDisplayMessages", () => {
  const ids = (list) => list.map((message) => message.message_id);
  const request = (id, ts, requestId) => ({
    message_id: id,
    ts,
    metadata: { type: "confirm_request", confirm_request_id: requestId },
  });
  const response = (id, ts, requestId, type = "confirm_accepted", extra = {}) => ({
    message_id: id,
    ts,
    metadata: { type, confirm_request_id: requestId, ...extra },
  });

  test("no messages gives an empty list", () => {
    expect(buildDisplayMessages({ messages: [], hasAcceptedConfirm: true, productId: 1 })).toEqual([]);
  });

  test("ordinary messages pass through, gaining parsed metadata", () => {
    const result = buildDisplayMessages({
      messages: [
        { message_id: 1, ts: 1, metadata: '{"type":"text"}' },
        { message_id: 2, ts: 2, metadata: "not json" },
        { message_id: 3, ts: 3 },
      ],
    });
    expect(ids(result)).toEqual([1, 2, 3]);
    expect(result[0].parsedMetadata).toEqual({ type: "text" });
    expect(result[1].parsedMetadata).toBeNull();
    expect(result[2].parsedMetadata).toBeNull();
  });

  test("replaces a confirm request with only its latest response", () => {
    const messages = [request(1, 1, 9), response(2, 2, 9, "confirm_denied"), response(3, 3, 9, "confirm_accepted")];
    expect(ids(buildDisplayMessages({ messages }))).toEqual([3]);
    // Same answer whatever order the messages arrive in.
    expect(ids(buildDisplayMessages({ messages: [...messages].reverse() }))).toEqual([3]);
  });

  test("a request without a response yet stays visible", () => {
    expect(ids(buildDisplayMessages({ messages: [request(1, 1, 9)] }))).toEqual([1]);
  });

  test("each confirm request is settled on its own", () => {
    const messages = [request(1, 1, 9), request(2, 2, 10), response(3, 3, 9, "confirm_denied")];
    expect(ids(buildDisplayMessages({ messages }))).toEqual([2, 3]);
  });

  test("an auto-accepted answer counts, and ties keep the first response seen", () => {
    const messages = [request(1, 1, 9), response(2, 5, 9, "confirm_auto_accepted"), response(3, 5, 9, "confirm_denied")];
    expect(ids(buildDisplayMessages({ messages }))).toEqual([2]);
  });

  test("a response with no timestamp yields to one that has one", () => {
    const messages = [response(1, undefined, 9, "confirm_denied"), response(2, 4, 9, "confirm_accepted")];
    expect(ids(buildDisplayMessages({ messages }))).toEqual([2]);
    expect(ids(buildDisplayMessages({ messages: [...messages].reverse() }))).toEqual([2]);
  });

  test("a terminal status on the request itself also hides the request", () => {
    const settled = { message_id: 1, ts: 1, metadata: { type: "confirm_request", confirm_request_id: 9, confirm_purchase_status: "buyer_declined" } };
    const open = { message_id: 2, ts: 2, metadata: { type: "confirm_request", confirm_request_id: 10, confirm_purchase_status: "pending" } };
    expect(ids(buildDisplayMessages({ messages: [settled, open] }))).toEqual([2]);
    const autoAccepted = { ...settled, metadata: { ...settled.metadata, confirm_purchase_status: "auto_accepted" } };
    expect(ids(buildDisplayMessages({ messages: [autoAccepted] }))).toEqual([]);
    const buyerAccepted = { ...settled, metadata: { ...settled.metadata, confirm_purchase_status: "buyer_accepted" } };
    expect(ids(buildDisplayMessages({ messages: [buyerAccepted] }))).toEqual([]);
  });

  test("messages without a confirm id are never hidden", () => {
    const messages = [
      { message_id: 1, ts: 1, metadata: { type: "confirm_request" } },
      { message_id: 2, ts: 2, metadata: { type: "confirm_accepted" } },
      { message_id: 3, ts: 3, metadata: { type: "confirm_denied" } },
    ];
    expect(ids(buildDisplayMessages({ messages }))).toEqual([1, 2, 3]);
  });

  describe("review prompts", () => {
    const accepted = response(1, 10, 9, "confirm_accepted");
    const base = { messages: [accepted], hasAcceptedConfirm: true, productId: 12 };

    test("the review prompt lands just after the latest accepted confirmation", () => {
      const result = buildDisplayMessages({ ...base, shouldShowReviewPrompt: true });
      expect(ids(result)).toEqual([1, "review_prompt_12"]);
      expect(result[1]).toMatchObject({
        sender: "system",
        content: "",
        ts: 11,
        metadata: { type: "review_prompt" },
        parsedMetadata: { type: "review_prompt" },
      });
    });

    test("the buyer rating prompt needs a receiver and lands after the review prompt", () => {
      const both = buildDisplayMessages({
        ...base,
        shouldShowReviewPrompt: true,
        shouldShowBuyerRatingPrompt: true,
        activeReceiverId: 5,
      });
      expect(ids(both)).toEqual([1, "review_prompt_12", "buyer_rating_prompt_12_5"]);
      expect(both[2]).toMatchObject({
        sender: "system",
        content: "",
        ts: 12,
        metadata: { type: "buyer_rating_prompt" },
        parsedMetadata: { type: "buyer_rating_prompt" },
      });

      const onlyRating = buildDisplayMessages({ ...base, shouldShowBuyerRatingPrompt: true, activeReceiverId: 5 });
      expect(ids(onlyRating)).toEqual([1, "buyer_rating_prompt_12_5"]);
      expect(ids(buildDisplayMessages({ ...base, shouldShowBuyerRatingPrompt: true }))).toEqual([1]);
    });

    test("no prompts when the flags are off", () => {
      expect(ids(buildDisplayMessages(base))).toEqual([1]);
    });

    test("no prompts without an accepted confirm flag, a product, or an accepted message", () => {
      const flags = { shouldShowReviewPrompt: true, shouldShowBuyerRatingPrompt: true, activeReceiverId: 5 };
      expect(ids(buildDisplayMessages({ ...base, ...flags, hasAcceptedConfirm: false }))).toEqual([1]);
      expect(ids(buildDisplayMessages({ ...base, ...flags, productId: 0 }))).toEqual([1]);
      expect(ids(buildDisplayMessages({ ...base, ...flags, productId: undefined }))).toEqual([1]);
      const denied = [response(1, 10, 9, "confirm_denied")];
      expect(ids(buildDisplayMessages({ ...base, ...flags, messages: denied }))).toEqual([1]);
    });

    test("an accepted message with no confirm request id does not anchor a prompt", () => {
      const stray = { message_id: 1, ts: 10, metadata: { type: "confirm_accepted" } };
      const strayStatus = { message_id: 2, ts: 10, metadata: { confirm_purchase_status: "buyer_accepted" } };
      const flags = { hasAcceptedConfirm: true, productId: 12, shouldShowReviewPrompt: true };
      expect(ids(buildDisplayMessages({ ...flags, messages: [stray, strayStatus] }))).toEqual([1, 2]);
    });

    test("an unsuccessful or timeless accepted message does not anchor a prompt", () => {
      const flags = { hasAcceptedConfirm: true, productId: 12, shouldShowReviewPrompt: true };
      const unsuccessful = response(1, 10, 9, "confirm_accepted", { is_successful: false });
      expect(ids(buildDisplayMessages({ ...flags, messages: [unsuccessful] }))).toEqual([1]);
      const timeless = response(1, 0, 9, "confirm_accepted");
      expect(ids(buildDisplayMessages({ ...flags, messages: [timeless] }))).toEqual([1]);
      const explicitlySuccessful = response(1, 10, 9, "confirm_accepted", { is_successful: true });
      expect(ids(buildDisplayMessages({ ...flags, messages: [explicitlySuccessful] }))).toEqual([1, "review_prompt_12"]);
    });

    test("the latest accepted confirmation anchors the prompt, whichever way it was accepted", () => {
      const flags = { hasAcceptedConfirm: true, productId: 12, shouldShowReviewPrompt: true };
      const messages = [
        response(1, 10, 9, "confirm_accepted"),
        { message_id: 2, ts: 30, metadata: { type: "confirm_request", confirm_request_id: 20, confirm_purchase_status: "auto_accepted" } },
        response(3, 20, 21, "confirm_auto_accepted"),
      ];
      const result = buildDisplayMessages({ ...flags, messages });
      // Message 2 is a settled request, so it is hidden, but its status still
      // marks the accepted moment (ts 30) the prompt hangs from.
      expect(ids(result)).toEqual([1, 3, "review_prompt_12"]);
      expect(result[result.length - 1]).toMatchObject({ message_id: "review_prompt_12", ts: 31 });

      const byStatus = [{ message_id: 1, ts: 40, metadata: { confirm_request_id: 5, confirm_purchase_status: "buyer_accepted" } }];
      expect(buildDisplayMessages({ ...flags, messages: byStatus }).pop()).toMatchObject({ ts: 41 });
    });

    test("messages are ordered by time, and a real message goes before a prompt at the same time", () => {
      const flags = { hasAcceptedConfirm: true, productId: 12, shouldShowReviewPrompt: true };
      const messages = [
        { message_id: "late", ts: 50 },
        { message_id: "same-time", ts: 11 },
        response(1, 10, 9, "confirm_accepted"),
        { message_id: "untimed" },
      ];
      expect(ids(buildDisplayMessages({ ...flags, messages }))).toEqual([
        "untimed",
        1,
        "same-time",
        "review_prompt_12",
        "late",
      ]);
      // Reversed input gives the same order.
      expect(ids(buildDisplayMessages({ ...flags, messages: [...messages].reverse() }))).toEqual([
        "untimed",
        1,
        "same-time",
        "review_prompt_12",
        "late",
      ]);
    });
  });
});
