import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ChatContext } from "../../context/ChatContext";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import ChatComposer from "./components/ChatComposer";
import ChatHeader from "./components/ChatHeader";
import ChatSidebar from "./components/ChatSidebar";
import DeleteConversationModal from "./components/DeleteConversationModal";
import MessageList from "./components/MessageList";
import ElectronicPaymentModal from "./components/ElectronicPaymentModal";
import useChatConversationStatus from "./hooks/useChatConversationStatus";
import useChatTypingStatus from "./hooks/useChatTypingStatus";
import useChatUsernames from "./hooks/useChatUsernames";
import { API_BASE } from "../../utils/apiConfig";
import { csrfFetch } from "../../utils/csrfFetch";
import {
  buildDisplayMessages,
  parseChatMetadata,
} from "./utils/chatPageUtils";
import useAutoGrowTextarea from "./hooks/useAutoGrowTextarea";
import useChatAutoScroll from "./hooks/useChatAutoScroll";

/** Root Chat page: wires context, sidebar, messages, and composer together */
export default function ChatPage() {
  /** Chat global state and actions from context */
  const ctx = useContext(ChatContext);
  const {
    conversations,
    activeConvId,
    messages,
    messagesByConv,
    typingStatusByConv,
    convError,
    chatByConvError,
    sendMsgError,
    unreadMsgByConv,
    myId,
    fetchConversation,
    createMessage,
    editMessage,
    deleteMessage,
    createImageMessage,
    clearActiveConversation,
    removeConversationLocal,
  } = ctx;

  const [searchParams, setSearchParams] = useSearchParams();
  const scrollRef = useRef(null);
  const [draft, setDraft] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [pendingDeleteConvId, setPendingDeleteConvId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [attachOpen, setAttachOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);

  // The hide-conversation dialog locks scroll itself (components/Dialog).
  useBodyScrollLock(paymentOpen);
  const [attachedImage, setAttachedImage] = useState(null);

  /** Sync textarea height before paint so composer row stays aligned with attach/send */
  const { taRef, autoGrow } = useAutoGrowTextarea(draft);

  const navigate = useNavigate();
  const location = useLocation();
  const navigationState =
    location.state && typeof location.state === "object"
      ? location.state
      : null;
  const activeConversation = conversations.find(
    (c) => c.conv_id === activeConvId,
  );

  /** Clear draft when item is deleted and prevent any input */
  useEffect(() => {
    if (activeConversation?.item_deleted) {
      // Clear draft immediately
      setDraft("");
      // Clear textarea value and remove focus
      if (taRef.current) {
        taRef.current.value = "";
        taRef.current.blur();
        // Force the textarea to be disabled
        taRef.current.disabled = true;
        taRef.current.readOnly = true;
      }
    } else {
      // Re-enable if item is not deleted
      if (taRef.current) {
        taRef.current.disabled = false;
        taRef.current.readOnly = false;
      }
    }
  }, [activeConversation?.item_deleted]);

  /** Compute header label for the active chat */
  const activeLabel = useMemo(() => {
    const c = conversations.find((c) => c.conv_id === activeConvId);
    if (c) return c.receiverName;
    if (navigationState?.receiverName) return navigationState.receiverName;
    if (navigationState?.receiverId)
      return `User ${navigationState.receiverId}`;
    return "Select a chat";
  }, [conversations, activeConvId, navigationState]);

  /** Extract first name for mobile display */
  const activeLabelFirstName = useMemo(() => {
    if (!activeLabel || activeLabel === "Select a chat") return activeLabel;
    return activeLabel.split(" ")[0];
  }, [activeLabel]);

  /** Split activeLabel into first and last name for desktop display */
  const { firstName: activeFirstName, lastName: activeLastName } =
    useMemo(() => {
      if (!activeLabel || activeLabel === "Select a chat") {
        return { firstName: activeLabel, lastName: "" };
      }
      const parts = activeLabel.trim().split(/\s+/);
      const firstName = parts[0] || "";
      const lastName = parts.slice(1).join(" ") || "";
      return { firstName, lastName };
    }, [activeLabel]);
  const activeReceiverId =
    activeConversation?.receiverId ?? navigationState?.receiverId ?? null;
  const { handleProfileHeaderClick } = useChatUsernames({
    activeReceiverId,
    conversations,
    navigationState,
    navigate,
  });

  /** Controls which pane is visible on mobile (list vs messages) */
  const [isMobileList, setIsMobileList] = useState(true);

  /** Handle deep-link via ?conv=ID in URL and auto-open that conversation */
  useEffect(() => {
    const convParam = searchParams.get("conv");
    if (convParam) {
      const convId = parseInt(convParam, 10);
      if (convId && convId !== activeConvId) {
        fetchConversation(convId);
        setIsMobileList(false);
      }
      setSearchParams({});
    }
  }, [searchParams, activeConvId, fetchConversation, setSearchParams]);

  /** When an active conversation exists, show the message pane on mobile */
  useEffect(() => {
    if (activeConvId) setIsMobileList(false);
  }, [activeConvId]);

  // Derive typing status from context (comes from fetch_new_messages)
  const typingStatus = activeConvId
    ? typingStatusByConv[activeConvId] || {
        is_typing: false,
        typing_user_first_name: null,
      }
    : null;
  const isOtherPersonTyping = typingStatus?.is_typing || false;
  const typingUserName = typingStatus?.typing_user_first_name || null;

  useChatAutoScroll(scrollRef, {
    activeConvId,
    messageCount: messages.length,
    isOtherPersonTyping,
  });

  /** Wrapper to prevent message creation when item is deleted. Resolves true on success. */
  const handleCreateMessage = useCallback(
    async (content) => {
      if (activeConversation?.item_deleted) return false;
      return createMessage(content);
    },
    [activeConversation?.item_deleted, createMessage],
  );

  /** Wrapper to prevent image message creation when item is deleted. Resolves true on success. */
  const handleCreateImageMessage = useCallback(
    async (content, file) => {
      if (activeConversation?.item_deleted) return false;
      return createImageMessage(content, file);
    },
    [activeConversation?.item_deleted, createImageMessage],
  );

  const { handleDraftChange, flushTypingOnSend } = useChatTypingStatus({
    activeConvId,
    conversations,
    setDraft,
    taRef,
  });

  const [isSending, setIsSending] = useState(false);
  const sendingRef = useRef(false);

  /**
   * Send text and/or attached media (Enter key or Send button). The composer
   * clears immediately so sending feels instant; if the send fails, the text
   * and attachment are put back (unless the user already started typing
   * something new) and the context's sendMsgError explains why.
   */
  const submitComposer = useCallback(async (fileOverride) => {
    if (activeConversation?.item_deleted || !activeConvId) return;
    if (sendingRef.current) return;
    const sentDraft = draft;
    // Phones send a picked file straight away; the Send button passes a click event.
    const sentImage = fileOverride instanceof Blob ? fileOverride : attachedImage;
    if (!sentImage && !sentDraft.trim()) return;

    sendingRef.current = true;
    setIsSending(true);
    setDraft("");
    setAttachedImage(null);
    flushTypingOnSend();
    try {
      const ok = sentImage
        ? await handleCreateImageMessage(sentDraft, sentImage)
        : await handleCreateMessage(sentDraft);
      if (!ok) {
        setDraft((current) => (current === "" ? sentDraft : current));
        if (sentImage) setAttachedImage((current) => current ?? sentImage);
      }
    } finally {
      sendingRef.current = false;
      setIsSending(false);
    }
  }, [
    activeConvId,
    activeConversation?.item_deleted,
    attachedImage,
    draft,
    flushTypingOnSend,
    handleCreateImageMessage,
    handleCreateMessage,
  ]);

  const canSendMessage =
    Boolean(activeConvId) &&
    !activeConversation?.item_deleted &&
    (Boolean(attachedImage) || draft.trim().length > 0);

  /** Keydown handler for textarea: submit on Enter (without Shift) */
  function handleKeyDown(e) {
    if (activeConversation?.item_deleted) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      return false;
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submitComposer();
    }
  }

  /** Open delete confirmation modal for a given conversation */
  function handleDeleteClick(convId, e) {
    e.stopPropagation();
    setPendingDeleteConvId(convId);
    setDeleteConfirmOpen(true);
    setDeleteError("");
  }

  /** Confirm hiding: call the API, then remove the row once the server agrees. */
  async function handleDeleteConfirm() {
    if (!pendingDeleteConvId || isDeleting) return;

    const convId = pendingDeleteConvId; // keep a local copy

    setIsDeleting(true);
    setDeleteError("");

    try {
      const res = await csrfFetch(`${API_BASE}/chat/delete_conversation.php`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ conv_id: convId }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to delete conversation");
      }

      const result = await res.json();
      if (!result.success) {
        throw new Error(result.error || "Failed to delete conversation");
      }

      // Only now drop the row and stop polling it; on failure it stays listed.
      removeConversationLocal(convId);
      if (convId === activeConvId) {
        clearActiveConversation();
      }
      setDeleteConfirmOpen(false);
      setPendingDeleteConvId(null);
    } catch (error) {
      setDeleteError(
        error.message || "Couldn't remove this conversation. Please try again.",
      );
    } finally {
      setIsDeleting(false);
    }
  }

  /** Cancel deletion: close modal and clear state */
  function handleDeleteCancel() {
    setDeleteConfirmOpen(false);
    setPendingDeleteConvId(null);
    setDeleteError("");
  }

  /** Determine if current user is the seller (seller perspective) */
  const isSellerPerspective =
    activeConversation?.productId &&
    activeConversation?.productSellerId &&
    myId &&
    Number(activeConversation.productSellerId) === Number(myId);

  const {
    checkActiveScheduledPurchase,
    checkConfirmStatus,
    confirmStatus,
    hasActiveScheduledPurchase,
    checkPaymentStatus,
    paymentStatus,
  } = useChatConversationStatus({
    activeConvId,
    activeConversation,
    isSellerPerspective,
    messagesLength: messages.length,
    myId,
  });

  /** Check if buyer has accepted confirm purchase and should see review prompt - memoized */
  const {
    hasAcceptedConfirm,
    shouldShowReviewPrompt,
    shouldShowBuyerRatingPrompt,
  } = useMemo(() => {
    const accepted = messages.some((m) => {
      const meta = parseChatMetadata(m.metadata);
      const msgType = meta?.type;
      return (
        (msgType === "confirm_accepted" ||
          msgType === "confirm_auto_accepted" || msgType === "payment_completed") &&
        meta?.is_successful !== false
      );
    });
    const showReview =
      !isSellerPerspective && accepted && activeConversation?.productId;
    const showBuyerRating =
      isSellerPerspective &&
      accepted &&
      activeConversation?.productId &&
      activeReceiverId;
    return {
      hasAcceptedConfirm: accepted,
      shouldShowReviewPrompt: showReview,
      shouldShowBuyerRatingPrompt: showBuyerRating,
    };
  }, [
    messages,
    isSellerPerspective,
    activeConversation?.productId,
    activeReceiverId,
  ]);

  const filteredMessages = useMemo(
    () =>
      buildDisplayMessages({
        activeReceiverId,
        hasAcceptedConfirm,
        messages,
        productId: activeConversation?.productId,
        shouldShowBuyerRatingPrompt,
        shouldShowReviewPrompt,
      }),
    [
      activeReceiverId,
      activeConversation?.productId,
      hasAcceptedConfirm,
      messages,
      shouldShowBuyerRatingPrompt,
      shouldShowReviewPrompt,
    ],
  );

  /** Header background color based on buyer vs seller perspective */
  const headerBgColor = isSellerPerspective
    ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
    : "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800";
  const isListingDraft = activeConversation?.productStatus === "Draft";

  /** Seller-only confirm state (null if not seller perspective) */
  const confirmState = isSellerPerspective
    ? isListingDraft
      ? {
          can_confirm: false,
          message: "Publish this listing before confirming a purchase.",
        }
      : (confirmStatus ?? {
          can_confirm: false,
          message: "Checking Confirm Purchase status...",
        })
    : null;

  /** Disable Confirm Purchase button if cannot confirm */
  const confirmButtonDisabled = confirmState ? !confirmState.can_confirm : true;
  /** Tooltip/title text for Confirm Purchase button */
  const confirmButtonTitle = confirmState?.message || "";

  /** Navigate to Schedule Purchase flow for seller */
  function handleSchedulePurchase() {
    if (
      !activeConvId ||
      !activeConversation?.productId ||
      isListingDraft ||
      hasActiveScheduledPurchase
    )
      return;
    navigate("/app/seller-dashboard/schedule-purchase", {
      state: { convId: activeConvId, productId: activeConversation.productId },
    });
  }

  /** Navigate to Confirm Purchase flow for seller */
  function handleConfirmPurchase() {
    if (!activeConvId || !activeConversation?.productId || isListingDraft)
      return;
    navigate("/app/seller-dashboard/confirm-purchase", {
      state: { convId: activeConvId, productId: activeConversation.productId },
    });
  }

  return (
    <div
      className={`${isMobileList ? "h-[calc(100dvh-var(--nav-h,64px))]" : "h-[100dvh] max-md:pt-[env(safe-area-inset-top,0px)]"} md:h-[calc(100dvh-var(--nav-h,64px))] w-full bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100`}
    >
      <div className={`mx-auto h-full max-w-[1200px] ${isMobileList ? "px-4 py-6" : "px-2 py-2 md:px-4 md:py-6"} short:!py-2`}>
        <div className="grid h-full grid-cols-12 gap-4">
          <ChatSidebar
            activeConvId={activeConvId}
            convError={convError}
            conversations={conversations}
            fetchConversation={fetchConversation}
            handleDeleteClick={handleDeleteClick}
            isMobileList={isMobileList}
            messages={messages}
            myId={myId}
            setIsMobileList={setIsMobileList}
            unreadMsgByConv={unreadMsgByConv}
          />

          <section
            className={
              `col-span-12 md:col-span-8 flex min-h-0 flex-col overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm ` +
              (isMobileList ? "hidden" : "flex") +
              " md:flex"
            }
          >
            <ChatHeader
              activeConvId={activeConvId}
              activeConversation={activeConversation}
              activeFirstName={activeFirstName}
              activeLabel={activeLabel}
              activeLabelFirstName={activeLabelFirstName}
              activeLastName={activeLastName}
              activeReceiverId={activeReceiverId}
              clearActiveConversation={clearActiveConversation}
              handleProfileHeaderClick={handleProfileHeaderClick}
              headerBgColor={headerBgColor}
              isSellerPerspective={isSellerPerspective}
              onElectronicPayment={() => setPaymentOpen(true)}
              paymentStatus={paymentStatus}
              navigate={navigate}
              setIsMobileList={setIsMobileList}
            />

            <MessageList
              activeConvId={activeConvId}
              activeConversation={activeConversation}
              activeReceiverId={activeReceiverId}
              chatByConvError={chatByConvError}
              checkActiveScheduledPurchase={checkActiveScheduledPurchase}
              checkConfirmStatus={checkConfirmStatus}
              checkPaymentStatus={checkPaymentStatus}
              conversations={conversations}
              fetchConversation={fetchConversation}
              filteredMessages={filteredMessages}
              isOtherPersonTyping={isOtherPersonTyping}
              messages={messages}
              messagesByConv={messagesByConv}
              editMessage={editMessage}
              deleteMessage={deleteMessage}
              scrollRef={scrollRef}
              typingUserName={typingUserName}
            />

            <ChatComposer
              activeConversation={activeConversation}
              attachOpen={attachOpen}
              attachedImage={attachedImage}
              autoGrow={autoGrow}
              canSendMessage={canSendMessage}
              confirmButtonDisabled={confirmButtonDisabled}
              confirmButtonTitle={confirmButtonTitle}
              confirmState={confirmState}
              draft={draft}
              handleConfirmPurchase={handleConfirmPurchase}
              handleDraftChange={handleDraftChange}
              isSending={isSending}
              sendError={sendMsgError}
              handleKeyDown={handleKeyDown}
              handleSchedulePurchase={handleSchedulePurchase}
              hasActiveScheduledPurchase={hasActiveScheduledPurchase}
              isSellerPerspective={isSellerPerspective}
              setAttachOpen={setAttachOpen}
              setAttachedImage={setAttachedImage}
              submitComposer={submitComposer}
              taRef={taRef}
            />
          </section>
        </div>
      </div>

      {deleteConfirmOpen && (
        <DeleteConversationModal
          deleteError={deleteError}
          isDeleting={isDeleting}
          onCancel={handleDeleteCancel}
          onConfirm={handleDeleteConfirm}
        />
      )}
      {paymentOpen && paymentStatus?.scheduled_request_id && (
        <ElectronicPaymentModal
          scheduledRequestId={paymentStatus.scheduled_request_id}
          onClose={() => setPaymentOpen(false)}
          onStatusChange={async () => {
            const controller = new AbortController();
            await checkPaymentStatus(controller.signal);
            if (activeConvId) await fetchConversation(activeConvId);
          }}
        />
      )}
    </div>
  );
}
