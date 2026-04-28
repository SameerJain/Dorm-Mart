import ImageModal from "./ImageModal";

export default function ChatComposer({
  MAX_LEN,
  activeConversation,
  attachOpen,
  attachedImage,
  autoGrow,
  canSendMessage,
  confirmButtonDisabled,
  confirmButtonTitle,
  confirmState,
  draft,
  handleConfirmPurchase,
  handleCreateImageMessage,
  handleDraftChange,
  handleKeyDown,
  handleSchedulePurchase,
  hasActiveScheduledPurchase,
  isSellerPerspective,
  setAttachOpen,
  setAttachedImage,
  setDraft,
  submitComposer,
  taRef,
}) {
  return (
    <div
      className={`sticky bottom-0 z-10 max-w-full overflow-x-hidden border-t border-gray-200 p-4 dark:border-gray-700 relative ${activeConversation?.item_deleted ? "bg-gray-100 dark:bg-gray-700" : "bg-white dark:bg-gray-800"}`}
    >
      {activeConversation?.item_deleted && (
        <div
          className="absolute inset-0 z-50 bg-gray-100 dark:bg-gray-700 opacity-90 cursor-not-allowed"
          onClick={(e) => e.preventDefault()}
          onMouseDown={(e) => e.preventDefault()}
          onKeyDown={(e) => e.preventDefault()}
          style={{ pointerEvents: "all" }}
          aria-label="Chat is closed"
        ></div>
      )}
      {isSellerPerspective && activeConversation?.productId && (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <button
            onClick={handleSchedulePurchase}
            disabled={hasActiveScheduledPurchase}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium transition ${
              hasActiveScheduledPurchase
                ? "bg-gray-400 dark:bg-gray-600 cursor-not-allowed text-white"
                : "bg-blue-600 hover:bg-blue-700 dark:hover:bg-blue-900 text-white"
            }`}
            title={
              hasActiveScheduledPurchase
                ? "There is already a Scheduled Purchase for this item"
                : ""
            }
          >
            Schedule Purchase
          </button>

          <button
            onClick={handleConfirmPurchase}
            disabled={confirmButtonDisabled}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium transition ${
              confirmButtonDisabled
                ? "bg-gray-400 dark:bg-gray-600 cursor-not-allowed text-white"
                : "bg-emerald-600 hover:bg-emerald-700 dark:hover:bg-emerald-600 text-white"
            }`}
            title={confirmButtonTitle}
          >
            Confirm Purchase
          </button>

          {confirmState &&
            confirmState.message &&
            !confirmState.can_confirm && (
              <p className="hidden md:block w-full text-xs text-gray-500 dark:text-gray-400">
                {confirmState.message}
              </p>
            )}
        </div>
      )}

      {attachedImage && (
        <div className="mb-1 flex items-center justify-between rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/40 px-3 py-1.5">
          <div className="flex items-center gap-2 min-w-0">
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <circle cx="8.5" cy="10" r="1.6" />
              <path d="M21 16l-5.5-5.5L9 17l-3-3-3 3" />
            </svg>
            <span className="truncate text-xs text-gray-700 dark:text-gray-200">
              {attachedImage.name}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setAttachedImage(null)}
            className="rounded-md p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
            aria-label="Remove attached image"
            title="Remove"
          >
            <svg
              viewBox="0 0 24 24"
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            if (!activeConversation?.item_deleted) {
              setAttachOpen(true);
            }
          }}
          disabled={activeConversation?.item_deleted}
          aria-label="Attach a file"
          aria-haspopup="dialog"
          aria-expanded={attachOpen}
          className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 border-gray-300 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 md:h-11 md:w-11 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 ${activeConversation?.item_deleted ? "cursor-not-allowed bg-gray-100 opacity-50 dark:bg-gray-700" : "hover:bg-gray-50 dark:hover:bg-gray-600"}`}
          title={
            activeConversation?.item_deleted
              ? "Item has been deleted"
              : "Attach"
          }
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5 shrink-0"
            aria-hidden="true"
          >
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <circle cx="8.5" cy="10" r="1.6" />
            <path d="M21 16l-5.5-5.5L9 17l-3-3-3 3" />
          </svg>
        </button>

        <div className="relative min-w-0 flex-1">
          {activeConversation?.item_deleted ? (
            <div className="relative w-full">
              <div className="flex h-12 min-h-12 w-full cursor-not-allowed items-center rounded-xl border-2 border-gray-300 bg-gray-300 px-3 py-2.5 pr-12 text-base leading-5 text-gray-500 opacity-80 pointer-events-none md:h-11 md:min-h-[44px] md:text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-500">
                <span>This chat has been closed.</span>
              </div>
            </div>
          ) : (
            <div className="relative w-full">
              <textarea
                ref={taRef}
                value={draft}
                onChange={handleDraftChange}
                onInput={autoGrow}
                onKeyDown={handleKeyDown}
                placeholder="Type a message."
                rows={1}
                maxLength={MAX_LEN}
                aria-describedby="message-char-remaining"
                wrap="soft"
                className="m-0 box-border block min-h-[44px] max-h-[28vh] w-full resize-none overflow-y-hidden whitespace-pre-wrap break-words rounded-xl border-2 border-gray-300 bg-white px-3 py-2.5 pr-11 text-base leading-5 text-gray-900 focus:ring-2 focus:ring-indigo-500 md:text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                aria-label="Message input"
              />
              <span
                id="message-char-remaining"
                className="pointer-events-none absolute right-2.5 bottom-2 text-xs text-gray-500 dark:text-gray-400"
              >
                {MAX_LEN - draft.length}
              </span>
            </div>
          )}

          <ImageModal
            open={attachOpen}
            onClose={() => setAttachOpen(false)}
            onSelect={(file) => {
              if (activeConversation?.item_deleted) {
                setAttachOpen(false);
                return;
              }
              const isMobile = window.innerWidth < 768;
              if (isMobile) {
                handleCreateImageMessage(draft, file);
                setDraft("");
                setAttachedImage(null);
              } else {
                setAttachedImage(file);
              }
              setAttachOpen(false);
            }}
          />
        </div>

        <button
          type="button"
          onClick={submitComposer}
          disabled={!canSendMessage}
          aria-label="Send message"
          className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 md:h-11 md:w-11 dark:bg-blue-800 dark:hover:bg-blue-900 dark:focus:ring-blue-600 dark:focus:ring-offset-gray-800"
          title="Send"
        >
          <svg
            className="h-5 w-5"
            fill="currentColor"
            viewBox="0 0 20 20"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
