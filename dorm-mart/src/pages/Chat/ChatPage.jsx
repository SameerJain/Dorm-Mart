import {
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
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
    unreadMsgByConv,
    myId,
    fetchConversation,
    createMessage,
    editMessage,
    createImageMessage,
    clearActiveConversation,
    removeConversationLocal,
  } = ctx;

  const [searchParams, setSearchParams] = useSearchParams();
  const MAX_LEN = 500;
  const scrollRef = useRef(null);
  const [draft, setDraft] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [pendingDeleteConvId, setPendingDeleteConvId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [attachOpen, setAttachOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);

  useBodyScrollLock(deleteConfirmOpen || paymentOpen);
  const [attachedImage, setAttachedImage] = useState(null);

  const taRef = useRef(null);
  const autoGrow = useCallback(() => {
    const el = taRef.current;
    if (!el) return;
    const minLine =
      typeof window !== "undefined" &&
      window.matchMedia("(min-width: 768px)").matches
        ? 44
        : 48;
    const trimmed = (el.value || "").trim();
    if (!trimmed) {
      el.style.height = `${minLine}px`;
      el.style.overflowY = "hidden";
      return;
    }
    el.style.height = "auto";
    const next = Math.max(minLine, el.scrollHeight);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > el.clientHeight ? "auto" : "hidden";
  }, []);

  /** Sync textarea height before paint so composer row stays aligned with attach/send */
  useLayoutEffect(() => {
    autoGrow();
  }, [draft, autoGrow]);

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

  /** Auto-scroll to bottom when active conversation or messages change - optimized with requestAnimationFrame */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    // Use requestAnimationFrame for smoother scrolling
    const rafId = requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });

    return () => cancelAnimationFrame(rafId);
    // Note: Removed automatic hiding of typing indicator on messages.length change
    // The backend already handles typing status expiration, and this was causing
    // race conditions where the indicator would disappear when messages were being fetched
  }, [activeConvId, messages.length]);

  /** Auto-scroll to bottom when typing indicator appears - optimized with requestAnimationFrame */
  useEffect(() => {
    if (isOtherPersonTyping) {
      // Use requestAnimationFrame for smoother scrolling
      const rafId = requestAnimationFrame(() => {
        const el = scrollRef.current;
        if (el) {
          el.scrollTop = el.scrollHeight;
        }
      });
      return () => cancelAnimationFrame(rafId);
    }
  }, [isOtherPersonTyping]);

  /** Wrapper to prevent message creation when item is deleted */
  const handleCreateMessage = useCallback(
    (content) => {
      if (activeConversation?.item_deleted) {
        return;
      }
      createMessage(content);
    },
    [activeConversation?.item_deleted, createMessage],
  );

  /** Wrapper to prevent image message creation when item is deleted */
  const handleCreateImageMessage = useCallback(
    (content, file) => {
      if (activeConversation?.item_deleted) {
        return;
      }
      createImageMessage(content, file);
    },
    [activeConversation?.item_deleted, createImageMessage],
  );

  const { handleDraftChange, flushTypingOnSend } = useChatTypingStatus({
    activeConvId,
    conversations,
    setDraft,
    taRef,
  });

  /** Send text and/or attached image (Enter key or Send button) */
  const submitComposer = useCallback(() => {
    if (activeConversation?.item_deleted || !activeConvId) return;
    if (attachedImage) {
      handleCreateImageMessage(draft, attachedImage);
      setDraft("");
      setAttachedImage(null);
      flushTypingOnSend();
      return;
    }
    if (!draft.trim()) return;
    handleCreateMessage(draft);
    setDraft("");
    setAttachedImage(null);
    flushTypingOnSend();
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

  /** Confirm deletion: call API, clear active if needed, then reload page */
  async function handleDeleteConfirm() {
    if (!pendingDeleteConvId || isDeleting) return;

    const convId = pendingDeleteConvId; // keep a local copy
    const wasActive = convId === activeConvId; // was this the open chat?

    // Immediately update local UI and stop polling for this conversation
    removeConversationLocal(convId);
    if (wasActive) {
      clearActiveConversation();
    }

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

      setDeleteConfirmOpen(false);
      setPendingDeleteConvId(null);

      // Optional: you probably don't need this anymore, but you can keep it as a safety net.
      // window.location.reload();
    } catch (error) {
      setDeleteError(
        error.message || "Failed to delete conversation. Please try again.",
      );
      // If you want to "undo" the local removal on error, you could reload or refetch here.
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
      className={`${isMobileList ? "h-[calc(100dvh-64px)]" : "h-[100dvh]"} md:h-[calc(100dvh-var(--nav-h))] w-full bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100`}
      style={{ "--nav-h": "64px" }}
    >
      <div className="mx-auto h-full max-w-[1200px] px-4 py-6">
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
              scrollRef={scrollRef}
              typingUserName={typingUserName}
            />

            <ChatComposer
              MAX_LEN={MAX_LEN}
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
              handleCreateImageMessage={handleCreateImageMessage}
              handleDraftChange={handleDraftChange}
              handleKeyDown={handleKeyDown}
              handleSchedulePurchase={handleSchedulePurchase}
              hasActiveScheduledPurchase={hasActiveScheduledPurchase}
              isSellerPerspective={isSellerPerspective}
              setAttachOpen={setAttachOpen}
              setAttachedImage={setAttachedImage}
              setDraft={setDraft}
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
