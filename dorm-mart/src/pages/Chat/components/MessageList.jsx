import fmtTime, { parseChatMetadata } from "../utils/chatPageUtils";
import MessageCard from "./MessageCard";
import ScheduleMessageCard from "./ScheduleMessageCard";
import NextStepsMessageCard from "./NextStepsMessageCard";
import ConfirmMessageCard from "./ConfirmMessageCard";
import ReviewPromptMessageCard from "./ReviewPromptMessageCard";
import BuyerRatingPromptMessageCard from "./BuyerRatingPromptMessageCard";
import ReportMessageModal from "./ReportMessageModal";
import MessageActions from "./MessageActions";
import TypingIndicatorMessage from "./TypingIndicatorMessage";
import PaymentSystemMessageCard from "./PaymentSystemMessageCard";
import { API_BASE } from "../../../utils/apiConfig";
import { csrfFetch } from "../../../utils/csrfFetch";
import { isVideoMediaUrl } from "../../../utils/imageFallback";
import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Report + copy state for one message. Actions live in the message's ⋯ menu;
 * this only surfaces a short status line after the user does something.
 */
function useMessageActionState(messageId, onDelete) {
  const [reportState, setReportState] = useState("idle"); // idle | confirming | reporting | reported | failed
  const [deleteState, setDeleteState] = useState("idle"); // idle | confirming | deleting | failed
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef(null);

  useEffect(() => () => clearTimeout(copiedTimer.current), []);

  async function report() {
    setReportState("reporting");
    try {
      const response = await csrfFetch(`${API_BASE}/moderation/report_message.php`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message_id: messageId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.error || "Unable to report message");
      setReportState("reported");
    } catch (_) {
      setReportState("failed");
    }
  }

  async function remove() {
    setDeleteState("deleting");
    try {
      await onDelete(messageId);
      // The message re-renders as a "deleted" placeholder, unmounting this state.
    } catch (_) {
      setDeleteState("failed");
    }
  }

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), 1500);
    } catch (_) {
      // Clipboard can be blocked (insecure context / permissions); nothing to undo.
    }
  }

  const reported = reportState === "reported";
  const reportAction = {
    key: "report",
    label: reported ? "Reported" : reportState === "failed" ? "Retry report" : "Report message",
    icon: "report",
    danger: true,
    disabled: reported || reportState === "reporting",
    onSelect: () => setReportState("confirming"),
  };

  const deleteAction = onDelete && {
    key: "delete",
    label: deleteState === "failed" ? "Retry delete" : "Delete message",
    icon: "trash",
    danger: true,
    disabled: deleteState === "deleting",
    onSelect: () => setDeleteState("confirming"),
  };

  const status = copied
    ? "Copied"
    : deleteState === "failed"
      ? "Couldn't delete the message. Try again from the message menu."
      : reported
      ? "Reported · a moderator will review it"
      : reportState === "failed"
        ? "Couldn't send the report. Try again from the message menu."
        : "";

  const modal =
    reportState === "confirming" || reportState === "reporting" ? (
      <ReportMessageModal
        isReporting={reportState === "reporting"}
        onCancel={() => setReportState("idle")}
        onConfirm={report}
      />
    ) : deleteState === "confirming" || deleteState === "deleting" ? (
      <ReportMessageModal
        title="Delete message?"
        body="This message will be removed for both of you and replaced with a note that it was deleted."
        confirmLabel="Delete"
        busyLabel="Deleting..."
        isReporting={deleteState === "deleting"}
        onCancel={() => setDeleteState("idle")}
        onConfirm={remove}
      />
    ) : null;

  const statusIsError = !copied && (reportState === "failed" || deleteState === "failed");
  return { copy, reportAction, deleteAction, status, statusIsError, modal };
}

function DeletedMessage({ mine }) {
  return (
    <div
      className={
        "flex max-w-[80%] items-center gap-1.5 rounded-2xl border border-dashed px-4 py-2 text-sm italic " +
        (mine
          ? "border-indigo-300 text-indigo-500 dark:border-indigo-700 dark:text-indigo-300"
          : "border-gray-300 text-gray-500 dark:border-gray-600 dark:text-gray-400")
      }
    >
      <svg className="h-3.5 w-3.5 flex-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 7h16M10 11v6m4-6v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
      </svg>
      {mine ? "You deleted this message" : "This message was deleted"}
    </div>
  );
}

function MessageStatus({ status, isError, align }) {
  return (
    <p
      aria-live="polite"
      className={
        "min-h-0 text-[10px] " +
        (status ? "mt-1 " : "") +
        (align === "end" ? "text-right " : "") +
        (isError ? "text-red-600 dark:text-red-400" : "text-gray-500 dark:text-gray-400")
      }
    >
      {status}
    </p>
  );
}

function triggerDownload(url) {
  const link = document.createElement("a");
  link.href = url;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function TextMessage({ message, canEdit, onEdit, canDelete, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const mine = message.sender === "me";
  const { copy, reportAction, deleteAction, status, statusIsError, modal } = useMessageActionState(
    message.message_id,
    canDelete ? onDelete : null,
  );

  async function save() {
    const content = draft.trim();
    if (!content || content.length > 500 || content === message.content) {
      if (content === message.content) setEditing(false);
      else setError(!content ? "Message cannot be empty." : "Message cannot exceed 500 characters.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onEdit(message.message_id, content);
      setEditing(false);
    } catch (err) {
      setError(err.message || "Unable to edit message.");
    } finally {
      setSaving(false);
    }
  }

  const actions = editing
    ? []
    : [
        { key: "copy", label: "Copy text", icon: "copy", quick: true, onSelect: () => copy(message.content) },
        canEdit && {
          key: "edit",
          label: "Edit message",
          icon: "edit",
          quick: true,
          onSelect: () => { setDraft(message.content); setEditing(true); },
        },
        mine ? deleteAction : reportAction,
      ];

  return (
    <MessageActions actions={actions} align={mine ? "end" : "start"} preview={message.content}>
      <div className={"rounded-2xl px-4 py-2 text-sm shadow " + (mine ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-gray-100")}>
        {editing ? (
          <div className="w-72 max-w-full animate-[fade-in_0.12s_ease-out] space-y-2">
            <div className="rounded-xl border border-white/40 bg-white/95 p-2.5 shadow-inner focus-within:border-white focus-within:ring-2 focus-within:ring-white/50">
              <textarea
                autoFocus
                value={draft}
                maxLength={500}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") { setDraft(message.content); setEditing(false); setError(""); }
                  else if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); save(); }
                }}
                className="min-h-16 w-full resize-none rounded-md border-0 bg-transparent p-0 text-sm text-gray-900 outline-none placeholder:text-gray-400"
                placeholder="Edit your message..."
              />
              <div className="mt-1 flex items-center justify-between text-[10px] text-gray-400">
                <span>Enter to save · Esc to cancel</span>
                <span className={draft.length >= 500 ? "font-semibold text-red-500" : ""}>{draft.length}/500</span>
              </div>
            </div>
            {error && (
              <p className="rounded-md bg-red-500/20 px-2 py-1 text-xs text-red-50" role="alert">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => { setDraft(message.content); setEditing(false); setError(""); }}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-indigo-100 transition-colors hover:bg-white/15 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving || !draft.trim() || draft.trim() === message.content}
                onClick={save}
                className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 shadow-sm transition-colors hover:bg-indigo-50 disabled:opacity-50 disabled:hover:bg-white"
              >
                {saving && (
                  <svg className="h-3 w-3 animate-spin text-indigo-700" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Z" />
                  </svg>
                )}
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="whitespace-pre-wrap break-words overflow-wrap-anywhere">{message.content}</p>
            <div className={"mt-1 text-[10px] " + (mine ? "text-indigo-100" : "text-gray-500 dark:text-gray-400")}>
              {fmtTime(message.ts)}{message.editedAt ? " · Edited" : ""}
            </div>
          </>
        )}
      </div>
      <MessageStatus status={status} isError={statusIsError} align={mine ? "end" : "start"} />
      {modal}
    </MessageActions>
  );
}

function MediaMessage({ message, canDelete, onDelete }) {
  const mine = message.sender === "me";
  const { copy, reportAction, deleteAction, status, statusIsError, modal } = useMessageActionState(
    message.message_id,
    canDelete ? onDelete : null,
  );
  const mediaSrc = `${API_BASE}/chat/serve_chat_image.php?message_id=${message.message_id}`;
  const dlSrc = `${mediaSrc}&download=1`;
  const isVideo = isVideoMediaUrl(message.image_url);

  const actions = [
    { key: "download", label: isVideo ? "Download video" : "Download image", icon: "download", quick: true, onSelect: () => triggerDownload(dlSrc) },
    message.content && { key: "copy", label: "Copy caption", icon: "copy", onSelect: () => copy(message.content) },
    mine ? deleteAction : reportAction,
  ];

  return (
    <MessageActions actions={actions} align={mine ? "end" : "start"} preview={message.content || (isVideo ? "Video" : "Photo")}>
      <div
        className={
          "rounded-2xl px-3 py-2 text-sm shadow " +
          (mine ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-gray-100")
        }
      >
        {isVideo ? (
          <video
            src={mediaSrc}
            controls
            preload="metadata"
            aria-label="Chat video attachment"
            className={"max-h-72 w-full rounded-lg object-contain " + (mine ? "bg-white/10" : "bg-black/5")}
          />
        ) : (
          <a href={mediaSrc} target="_blank" rel="noopener noreferrer" className="block" title="Chat Image - Click to view full size">
            <img
              src={mediaSrc}
              alt="Chat attachment"
              className={"max-h-72 w-full object-contain rounded-lg " + (mine ? "bg-white/10" : "bg-black/5")}
              loading="lazy"
            />
          </a>
        )}
        {message.content && (
          <p className="mt-2 whitespace-pre-wrap break-words overflow-wrap-anywhere">{message.content}</p>
        )}
        <div className={"mt-1 text-[10px] " + (mine ? "text-indigo-100" : "text-gray-500 dark:text-gray-400")}>
          {fmtTime(message.ts)}
        </div>
      </div>
      <MessageStatus status={status} isError={statusIsError} align={mine ? "end" : "start"} />
      {modal}
    </MessageActions>
  );
}

export default function MessageList({
  activeConvId,
  activeConversation,
  activeReceiverId,
  chatByConvError,
  checkActiveScheduledPurchase,
  checkConfirmStatus,
  checkPaymentStatus,
  conversations,
  fetchConversation,
  filteredMessages,
  isOtherPersonTyping,
  messages,
  messagesByConv,
  editMessage,
  deleteMessage,
  scrollRef,
  typingUserName,
}) {
  const { lastEditableId, lastDeletableId } = useMemo(() => {
    const live = [...filteredMessages]
      .reverse()
      .filter((message) => message.sender === "me" && !message.deletedAt && Number(message.message_id) > 0);
    const editable = live.find((message) => !message.image_url && !message.metadata);
    // delete_message.php only accepts your newest message of any kind, so offer
    // Delete only when that newest message is a plain text/media bubble.
    const newest = live[0];
    return {
      lastEditableId: editable ? Number(editable.message_id) : null,
      lastDeletableId: newest && !newest.metadata ? Number(newest.message_id) : null,
    };
  }, [filteredMessages]);
  return (
    <div
      ref={scrollRef}
      className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden space-y-2 px-4 py-4"
      role="log"
      aria-live="polite"
      aria-relevant="additions"
    >
      {!activeConvId ? (
        <div className="flex h-full items-center justify-center px-4">
          {conversations.length === 0 ? (
            <p className="text-sm md:text-base text-gray-500 dark:text-gray-400 text-center font-medium">
              Any chats with users will be displayed here
            </p>
          ) : (
            <p className="text-sm md:text-base text-gray-500 dark:text-gray-400 text-center">
              Select a chat to view messages.
            </p>
          )}
        </div>
      ) : chatByConvError[activeConvId] === true ? (
        <p className="text-center text-sm text-red-600 dark:text-red-400">
          Something went wrong, please try again later
        </p>
      ) : messagesByConv[activeConvId] === undefined ? (
        <div className="flex h-full items-center justify-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Loading messages...
          </p>
        </div>
      ) : messages.length === 0 ? (
        <p className="text-center text-sm text-gray-500 dark:text-gray-400">
          No messages yet.
        </p>
      ) : (
        filteredMessages.map((m) => {
          const metadata = m.parsedMetadata || parseChatMetadata(m.metadata);
          const messageType = metadata?.type;
          const isScheduleMessage =
            messageType === "schedule_request" ||
            messageType === "schedule_accepted" ||
            messageType === "schedule_denied" ||
            messageType === "schedule_cancelled" ||
            messageType === "schedule_expired";
          const isConfirmMessageType =
            messageType === "confirm_request" ||
            messageType === "confirm_accepted" ||
            messageType === "confirm_denied" ||
            messageType === "confirm_auto_accepted";

          const confirmRequestId = metadata?.confirm_request_id;
          const wouldConfirmCardReturnNull =
            !messageType ||
            (messageType === "confirm_request" && !confirmRequestId);
          const isConfirmMessage =
            isConfirmMessageType && !wouldConfirmCardReturnNull;
          const isNextStepsMessage = messageType === "next_steps";
          const isReviewPrompt = messageType === "review_prompt";
          const isBuyerRatingPrompt = messageType === "buyer_rating_prompt";
          const isPaymentMessage = ["payment_completed", "payment_fallback", "payment_refunded"].includes(messageType);
          const isItemDeletedMessage =
            messageType === "item_deleted" || messageType === "account_deleted";
          const messageWithMetadata = {
            ...m,
            metadata: metadata || m.metadata,
          };

          if (isConfirmMessageType && wouldConfirmCardReturnNull) {
            return null;
          }

          if (isReviewPrompt) {
            return (
              <div key={m.message_id}>
                <ReviewPromptMessageCard
                  productId={activeConversation?.productId}
                  productTitle={activeConversation?.productTitle}
                />
              </div>
            );
          }

          if (isBuyerRatingPrompt) {
            return (
              <div key={m.message_id}>
                <BuyerRatingPromptMessageCard
                  productId={activeConversation?.productId}
                  productTitle={activeConversation?.productTitle}
                  buyerId={activeReceiverId}
                />
              </div>
            );
          }

          if (isPaymentMessage) {
            return <PaymentSystemMessageCard key={m.message_id} message={messageWithMetadata} />;
          }

          return (
            <div key={m.message_id}>
              {isNextStepsMessage ? (
                <NextStepsMessageCard message={messageWithMetadata} />
              ) : isItemDeletedMessage ? (
                <div className="flex justify-center my-2">
                  <div className="max-w-[85%] rounded-2xl border-2 border-red-400 dark:border-red-600 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-300 overflow-hidden">
                    <div className="p-4">
                      <div className="flex items-start gap-2">
                        <svg
                          className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                          />
                        </svg>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-red-800 dark:text-red-200 mb-1">
                            {messageType === "account_deleted" ? "Account Deleted" : "Item Removed"}
                          </p>
                          <p className="text-sm text-red-700 dark:text-red-300">
                            {messageType === "account_deleted"
                              ? "This user's account has been deleted. This chat has been closed."
                              : "This chat has been closed."}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  className={
                    m.sender === "me"
                      ? "flex justify-end"
                      : "flex justify-start"
                  }
                >
                  {messageType === "listing_intro" ? (
                    <MessageCard
                      message={messageWithMetadata}
                      listingUnavailable={
                        activeConversation?.productStatus === "Draft"
                      }
                    />
                  ) : isScheduleMessage ? (
                    <ScheduleMessageCard
                      message={messageWithMetadata}
                      isMine={m.sender === "me"}
                      onRespond={async () => {
                        if (activeConvId) {
                          await fetchConversation(activeConvId);
                          const controller = new AbortController();
                          await checkActiveScheduledPurchase(controller.signal);
                          await checkConfirmStatus(controller.signal);
                          await checkPaymentStatus(controller.signal);
                        }
                      }}
                    />
                  ) : isConfirmMessage ? (
                    <ConfirmMessageCard
                      message={messageWithMetadata}
                      isMine={m.sender === "me"}
                      onRespond={async () => {
                        if (activeConvId) {
                          await fetchConversation(activeConvId);
                          const controller = new AbortController();
                          await checkConfirmStatus(controller.signal);
                        }
                      }}
                    />
                  ) : m.deletedAt ? (
                    <DeletedMessage mine={m.sender === "me"} />
                  ) : messageWithMetadata.image_url ? (
                    <MediaMessage
                      message={messageWithMetadata}
                      canDelete={Number(m.message_id) === lastDeletableId}
                      onDelete={deleteMessage}
                    />
                  ) : (
                    <TextMessage
                      message={m}
                      canEdit={Number(m.message_id) === lastEditableId}
                      onEdit={editMessage}
                      canDelete={Number(m.message_id) === lastDeletableId}
                      onDelete={deleteMessage}
                    />
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
      {isOtherPersonTyping && activeConvId && (
        <TypingIndicatorMessage firstName={typingUserName} />
      )}
    </div>
  );
}
