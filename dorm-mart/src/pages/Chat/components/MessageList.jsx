import fmtTime, { parseChatMetadata } from "../utils/chatPageUtils";
import MessageCard from "./MessageCard";
import ScheduleMessageCard from "./ScheduleMessageCard";
import NextStepsMessageCard from "./NextStepsMessageCard";
import ConfirmMessageCard from "./ConfirmMessageCard";
import ReviewPromptMessageCard from "./ReviewPromptMessageCard";
import BuyerRatingPromptMessageCard from "./BuyerRatingPromptMessageCard";
import TypingIndicatorMessage from "./TypingIndicatorMessage";
import PaymentSystemMessageCard from "./PaymentSystemMessageCard";
import { API_BASE } from "../../../utils/apiConfig";
import { csrfFetch } from "../../../utils/csrfFetch";
import { isVideoMediaUrl } from "../../../utils/imageFallback";
import { useMemo, useState } from "react";

function ReportButton({ messageId }) {
  const [reported, setReported] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [failed, setFailed] = useState(false);

  async function report() {
    setReporting(true);
    setFailed(false);
    try {
      const response = await csrfFetch(`${API_BASE}/moderation/report_message.php`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message_id: messageId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.error || "Unable to report message");
      setReported(true);
    } catch (_) {
      setFailed(true);
    } finally {
      setReporting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={report}
      disabled={reported || reporting}
      title={failed ? "The report could not be sent. Try again." : undefined}
      className="mt-1 text-[10px] font-semibold text-red-600 hover:underline disabled:text-gray-400 disabled:no-underline dark:text-red-400"
    >
      {reported ? "Reported" : reporting ? "Reporting..." : failed ? "Retry report" : "Report"}
    </button>
  );
}

function TextMessage({ message, canEdit, onEdit }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const mine = message.sender === "me";

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

  return (
    <div className={"group max-w-[80%] rounded-2xl px-4 py-2 text-sm shadow " + (mine ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-gray-100")}>
      {editing ? (
        <div className="w-64 max-w-full space-y-2">
          <textarea autoFocus value={draft} maxLength={500} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Escape") { setDraft(message.content); setEditing(false); setError(""); } else if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); save(); } }} className="min-h-20 w-full resize-none rounded-lg border border-indigo-300 bg-white p-2 text-gray-900 outline-none focus:ring-2 focus:ring-indigo-300" />
          {error && <p className="text-xs text-red-100" role="alert">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" disabled={saving} onClick={() => { setDraft(message.content); setEditing(false); setError(""); }} className="rounded px-2 py-1 text-xs hover:bg-white/15">Cancel</button>
            <button type="button" disabled={saving} onClick={save} className="rounded bg-white px-2 py-1 text-xs font-semibold text-indigo-700 disabled:opacity-60">{saving ? "Saving..." : "Save"}</button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start gap-2">
            <p className="min-w-0 flex-1 whitespace-pre-wrap break-words overflow-wrap-anywhere">{message.content}</p>
            {canEdit && <button type="button" aria-label="Edit last message" title="Edit message" onClick={() => { setDraft(message.content); setEditing(true); }} className="rounded p-1 text-indigo-100 opacity-100 hover:bg-white/15 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100">✎</button>}
          </div>
          <div className={"mt-1 text-[10px] " + (mine ? "text-indigo-100" : "text-gray-500 dark:text-gray-400")}>
            {fmtTime(message.ts)}{message.editedAt ? " · Edited" : ""}
          </div>
          {!mine && <ReportButton messageId={message.message_id} />}
        </>
      )}
    </div>
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
  scrollRef,
  typingUserName,
}) {
  const lastEditableId = useMemo(() => {
    const latest = [...filteredMessages].reverse().find((message) =>
      message.sender === "me" && !message.image_url && !message.metadata && Number(message.message_id) > 0,
    );
    return latest ? Number(latest.message_id) : null;
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
                  ) : messageWithMetadata.image_url ? (
                    <div
                      className={
                        "max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow " +
                        (m.sender === "me"
                          ? "bg-indigo-600 text-white"
                          : "bg-gray-100 text-gray-900")
                      }
                    >
                      {(() => {
                        const mediaSrc = `${API_BASE}/chat/serve_chat_image.php?message_id=${m.message_id}`;
                        const dlSrc = `${mediaSrc}&download=1`;
                        const isVideo = isVideoMediaUrl(
                          messageWithMetadata.image_url,
                        );
                        return (
                          <>
                            {isVideo ? (
                              <video
                                src={mediaSrc}
                                controls
                                preload="metadata"
                                aria-label="Chat video attachment"
                                className={
                                  "max-h-72 w-full rounded-lg object-contain " +
                                  (m.sender === "me"
                                    ? "bg-white/10"
                                    : "bg-black/5")
                                }
                              />
                            ) : (
                              <a
                                href={mediaSrc}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block"
                                title="Chat Image - Click to view full size"
                              >
                                <img
                                  src={mediaSrc}
                                  alt="Chat attachment"
                                  className={
                                    "max-h-72 w-full object-contain rounded-lg " +
                                    (m.sender === "me"
                                      ? "bg-white/10"
                                      : "bg-black/5")
                                  }
                                  loading="lazy"
                                />
                              </a>
                            )}
                            {m.content && (
                              <p className="mt-2 whitespace-pre-wrap break-words overflow-wrap-anywhere">
                                {m.content}
                              </p>
                            )}
                            <div
                              className={
                                "mt-1 flex items-center justify-between text-[10px] " +
                                (m.sender === "me"
                                  ? "text-indigo-100"
                                  : "text-gray-500 dark:text-gray-400")
                              }
                            >
                              <span>{fmtTime(m.ts)}</span>
                              <a
                                href={dlSrc}
                                className={
                                  "ml-3 underline hover:no-underline " +
                                  (m.sender === "me"
                                    ? "text-indigo-100"
                                    : "text-gray-600 dark:text-gray-400")
                                }
                              >
                                Download
                              </a>
                            </div>
                            {m.sender !== "me" && <ReportButton messageId={m.message_id} />}
                          </>
                        );
                      })()}
                    </div>
                  ) : (
                    <TextMessage message={m} canEdit={Number(m.message_id) === lastEditableId} onEdit={editMessage} />
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
