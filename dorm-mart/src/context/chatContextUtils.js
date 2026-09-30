import { API_BASE } from "../utils/apiConfig";
import { csrfFetch } from "../utils/csrfFetch";
import logger from "../utils/logger";

// Shared with RootLayout so the two startup auth checks become one request.
export { fetchMe } from "../utils/handleAuth";

// Session-authenticated GET used by every chat/notification poll.
async function pollGet(path, signal) {
  const r = await fetch(`${API_BASE}${path}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "include",
    signal,
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export function fetchConversations(signal) {
  // returns: { success: true, conversations: [{ conv_id, user_1, user_2, ... }] }
  return pollGet("/chat/fetch_conversations.php", signal);
}

export function fetchConversationApi(convId, signal) {
  // returns: { success: true, messages: [{ message_id, sender_id, content, created_at, ... }] }
  return pollGet(`/chat/fetch_conversation.php?conv_id=${convId}`, signal);
}

export function fetchNewMessages(activeConvId, ts, signal) {
  return pollGet(
    `/chat/fetch_new_messages.php?conv_id=${activeConvId}&ts=${ts}`,
    signal,
  );
}

export async function editLastMessageApi(messageId, content) {
  const response = await csrfFetch(`${API_BASE}/chat/edit_last_message.php`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    credentials: "include",
    body: JSON.stringify({ message_id: messageId, content }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.success) throw new Error(data?.error || "Unable to edit message");
  return data.message;
}

// Soft delete: the row (and its content) stays in the database for moderation;
// both participants just see "This message was deleted".
export async function deleteMessageApi(messageId) {
  const response = await csrfFetch(`${API_BASE}/chat/delete_message.php`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    credentials: "include",
    body: JSON.stringify({ message_id: messageId }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.success) throw new Error(data?.error || "Unable to delete message");
  return data;
}

export async function tickFetchNewMessages(
  activeConvId,
  myId,
  sinceSec,
  signal,
) {
  const res = await fetchNewMessages(activeConvId, sinceSec, signal);
  const raw = res?.messages ?? [];
  const typingStatus = res?.typing_status || {
    is_typing: false,
    typing_user_first_name: null,
  };
  const cursorTs = Number(res?.cursor_ts) || 0;
  const conversationStatus = res?.conversation_status
    ? {
        productStatus: res.conversation_status.product_status || null,
        itemDeleted: Boolean(res.conversation_status.item_deleted),
      }
    : null;

  const myIdNum = Number(myId);
  if (!Number.isInteger(myIdNum) || myIdNum <= 0) {
    logger.error("Invalid myId in tickFetchNewMessages:", myId);
    return { messages: [], typingStatus, cursorTs, conversationStatus };
  }

  // Always return typing status, even if no new messages
  if (!raw.length) {
    return { messages: [], typingStatus, cursorTs, conversationStatus };
  }

  const messages = raw.map((m) => {
    const senderIdNum = Number(m.sender_id);
    const metadata = (() => {
      if (!m.metadata) return null;
      if (typeof m.metadata === "object") return m.metadata;
      try {
        return JSON.parse(m.metadata);
      } catch {
        return null;
      }
    })();

    // be lenient about key names coming from backend
    const imageUrl = m.image_url ?? m.imagePath ?? m.image_path ?? null;

    // base shape
    const base = {
      message_id: m.message_id,
      sender:
        Number.isInteger(senderIdNum) && senderIdNum > 0
          ? senderIdNum === myIdNum
            ? "me"
            : "them"
          : "them",
      content: m.content ?? "",
      ts: Date.parse(m.created_at),
      editedAt: m.edited_at ? Date.parse(m.edited_at) : null,
      deletedAt: m.deleted_at ? Date.parse(m.deleted_at) : null,
      activityTs: Date.parse(m.activity_at || m.edited_at || m.created_at),
      metadata,
    };

    // only add the flag/field if present
    if (imageUrl) base.image_url = imageUrl;
    // Uncensored text, sent only for the viewer's own messages (used to edit).
    if (typeof m.raw_content === "string") base.rawContent = m.raw_content;

    return base;
  });

  return { messages, typingStatus, cursorTs, conversationStatus };
}

export function fetchUnreadMessages(signal) {
  return pollGet("/chat/fetch_unread_messages.php", signal);
}

export async function tickFetchUnreadMessages(signal) {
  const res = await fetchUnreadMessages(signal);
  const raw = res.unreads ?? [];

  // build { conv_id -> count }
  const unreads = {};
  let total = 0;
  for (const u of raw) {
    const cid = Number(u.conv_id);
    const cnt = Number(u.unread_count) || 0;
    if (cid > 0 && cnt > 0) {
      unreads[cid] = cnt;
      total += cnt;
    }
  }
  return { unreads, total };
}

export function fetchUnreadNotifications(signal) {
  return pollGet("/wishlist/fetch_unread_notifications.php", signal);
}

export async function tickFetchUnreadNotifications(signal) {
  const res = await fetchUnreadNotifications(signal);
  return {
    notifications: Array.isArray(res.notifications) ? res.notifications : [],
    total: Number(res.unread_total) || 0,
  };
}

const SEND_ERROR_MESSAGES = {
  missing_fields: "Type a message before sending.",
  missing_image: "Choose a photo or video to send.",
  content_too_long: "Messages can be at most 500 characters.",
  file_too_large: "That file is too large to send. Videos can be up to 25 MB.",
  image_too_large: "Photos can be up to 2 MB.",
  unsupported_type: "That file type isn't supported. Send a JPG, PNG, WebP, MP4, WebM, or MOV file.",
};

/**
 * Turn a failed send response into a sentence the chat can show. The server's
 * own message is kept when it is already readable (rate limits, closed chats);
 * machine codes are mapped; anything else gets a generic retry hint.
 */
export function chatSendErrorMessage(status, data) {
  const code = data && typeof data.error === "string" ? data.error.trim() : "";
  if (SEND_ERROR_MESSAGES[code]) return SEND_ERROR_MESSAGES[code];
  if (status === 413) return "That file is too large to send.";
  if (status === 429) {
    return code.includes(" ")
      ? code
      : "You're sending messages too quickly. Wait a moment and try again.";
  }
  if (code && code.includes(" ") && code !== "Server error") return code;
  if (status === 0) return "You appear to be offline. Your message was not sent.";
  return "Your message couldn't be sent. Please try again.";
}

async function throwSendError(response) {
  const data = await response.json().catch(() => null);
  const error = new Error(chatSendErrorMessage(response.status, data));
  error.status = response.status;
  throw error;
}

/**
 * Insert a message into a conversation list, or replace the copy that is
 * already there. Polling often delivers a just-sent message before the POST
 * resolves; appending blindly left a duplicate bubble with a duplicate key.
 */
export function upsertMessage(list, message) {
  const existing = Array.isArray(list) ? list : [];
  const id = Number(message?.message_id);
  if (!Number.isFinite(id)) return [...existing, message];
  const index = existing.findIndex((item) => Number(item.message_id) === id);
  if (index === -1) return [...existing, message];
  const next = existing.slice();
  next[index] = { ...existing[index], ...message };
  return next;
}

export async function createMessageApi({
  receiverId,
  convId,
  content,
  signal,
}) {
  const body = {
    receiver_id: receiverId,
    content,
  };
  if (convId) {
    body.conv_id = convId;
  }
  const r = await csrfFetch(`${API_BASE}/chat/create_message.php`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json", // tells PHP we're sending JSON
      Accept: "application/json",
    },
    credentials: "include", // sends PHP session cookie if your server uses it
    body: JSON.stringify(body),
    signal, // lets you cancel if needed
  });
  if (!r.ok) await throwSendError(r);
  return r.json(); // expect JSON back from PHP
}

// Image-message endpoint (multipart/form-data)
export async function createImageMessageApi({
  receiverId,
  convId,
  content,
  image,
  signal,
}) {
  const form = new FormData(); // browser handles multipart boundary
  form.append("receiver_id", String(receiverId)); // PHP: $_POST['receiver_id']
  if (convId) form.append("conv_id", String(convId));
  form.append("content", content ?? ""); // optional caption
  form.append("image", image, image.name); // PHP: $_FILES['image']

  const r = await csrfFetch(`${API_BASE}/chat/create_image_message.php`, {
    method: "POST",
    body: form, // DO NOT set Content-Type manually
    credentials: "include",
    signal,
  });
  if (!r.ok) await throwSendError(r);
  return r.json(); // expects { success, message: { ... , image_url } }
}

export function envBool(value, fallback = false) {
  if (value == null) return fallback;
  const v = String(value).trim().toLowerCase();
  // Accept common truthy/falsey spellings
  if (v === "true") return true;
  if (v === "false") return false;
  return fallback;
}
