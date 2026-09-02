export default function fmtTime(ts) {
  const d = new Date(ts); // if ts is seconds, use new Date(ts * 1000)
  const now = new Date();

  // Compare calendar dates in the user's local time zone
  const sameLocalDate = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  // 1) Today -> just time with AM/PM (local)
  if (sameLocalDate(d, now)) {
    return d.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true, // includes AM/PM
    });
  }

  // 2) Yesterday -> "yesterday HH:MM AM/PM" (local)
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameLocalDate(d, yesterday)) {
    const time = d.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
    return `yesterday ${time}`;
  }

  // 3) Otherwise -> full date + time with AM/PM (local)
  return d.toLocaleString([], {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

const CONFIRM_RESPONSE_TYPES = new Set([
  "confirm_accepted",
  "confirm_denied",
  "confirm_auto_accepted",
]);
const ACCEPTED_CONFIRM_TYPES = new Set([
  "confirm_accepted",
  "confirm_auto_accepted",
]);
const TERMINAL_CONFIRM_STATUSES = new Set([
  "buyer_accepted",
  "buyer_declined",
  "auto_accepted",
]);
const ACCEPTED_CONFIRM_STATUSES = new Set([
  "buyer_accepted",
  "auto_accepted",
]);

export function parseChatMetadata(metadata) {
  if (!metadata || typeof metadata === "object") return metadata || null;
  try {
    return JSON.parse(metadata);
  } catch {
    return null;
  }
}

const isVirtualPrompt = (message) =>
  String(message.message_id || "").startsWith("review_prompt_") ||
  String(message.message_id || "").startsWith("buyer_rating_prompt_");

export function buildDisplayMessages({
  activeReceiverId,
  hasAcceptedConfirm,
  messages,
  productId,
  shouldShowBuyerRatingPrompt,
  shouldShowReviewPrompt,
}) {
  if (!messages.length) return [];

  const parsed = messages.map((message) => ({
    ...message,
    parsedMetadata: parseChatMetadata(message.metadata),
  }));
  const terminalRequestIds = new Set();
  const latestResponseByRequestId = new Map();
  let latestAcceptedTs = null;

  parsed.forEach((message) => {
    const metadata = message.parsedMetadata;
    const requestId = metadata?.confirm_request_id;
    if (!requestId) return;

    const type = metadata?.type;
    const status = metadata?.confirm_purchase_status;
    if (CONFIRM_RESPONSE_TYPES.has(type)) {
      terminalRequestIds.add(requestId);
      const previous = latestResponseByRequestId.get(requestId);
      if (!previous || (message.ts || 0) > (previous.ts || 0)) {
        latestResponseByRequestId.set(requestId, message);
      }
    }
    if (TERMINAL_CONFIRM_STATUSES.has(status)) terminalRequestIds.add(requestId);

    const accepted =
      ACCEPTED_CONFIRM_TYPES.has(type) || ACCEPTED_CONFIRM_STATUSES.has(status);
    if (accepted && metadata?.is_successful !== false && message.ts) {
      latestAcceptedTs = Math.max(latestAcceptedTs || 0, message.ts);
    }
  });

  const filtered = parsed.filter((message) => {
    const metadata = message.parsedMetadata;
    const requestId = metadata?.confirm_request_id;
    if (
      metadata?.type === "confirm_request" &&
      requestId &&
      terminalRequestIds.has(requestId)
    ) {
      return false;
    }
    return !(
      requestId &&
      CONFIRM_RESPONSE_TYPES.has(metadata?.type) &&
      latestResponseByRequestId.get(requestId) !== message
    );
  });

  if (latestAcceptedTs === null || !hasAcceptedConfirm || !productId) {
    return filtered;
  }

  const prompts = [];
  if (shouldShowReviewPrompt) {
    prompts.push({
      message_id: `review_prompt_${productId}`,
      sender: "system",
      content: "",
      ts: latestAcceptedTs + 1,
      metadata: { type: "review_prompt" },
      parsedMetadata: { type: "review_prompt" },
    });
  }
  if (shouldShowBuyerRatingPrompt && activeReceiverId) {
    prompts.push({
      message_id: `buyer_rating_prompt_${productId}_${activeReceiverId}`,
      sender: "system",
      content: "",
      ts: latestAcceptedTs + 2,
      metadata: { type: "buyer_rating_prompt" },
      parsedMetadata: { type: "buyer_rating_prompt" },
    });
  }

  return [...filtered, ...prompts].sort((a, b) => {
    const timeDifference = (a.ts || 0) - (b.ts || 0);
    if (timeDifference) return timeDifference;
    return Number(isVirtualPrompt(a)) - Number(isVirtualPrompt(b));
  });
}
