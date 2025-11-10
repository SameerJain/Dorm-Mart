import { useContext, useEffect, useMemo, useRef, useState, useCallback } from "react";
import { ChatContext } from "../../context/ChatContext";
import fmtTime from "./chat_page_utils";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import MessageCard from "./components/MessageCard";
import ScheduleMessageCard from "./components/ScheduleMessageCard";
import ImageModal from "./components/ImageModal";

const PUBLIC_BASE = (process.env.PUBLIC_URL || "").replace(/\/$/, "");
const API_BASE = (process.env.REACT_APP_API_BASE || `${PUBLIC_BASE}/api`).replace(/\/$/, "");

export default function ChatPage() {
  const ctx = useContext(ChatContext);
  const {
    // chat
    conversations,
    activeConvId,
    messages,
    messagesByConv,
    convError,
    chatByConvError,
    unreadByConv,
    myId,
    // actions
    fetchConversation,
    createMessage,
    createImageMessage,
    clearActiveConversation
  } = ctx;

  const [searchParams, setSearchParams] = useSearchParams();
  const MAX_LEN = 500;
  const scrollRef = useRef(null);
  const [draft, setDraft] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [pendingDeleteConvId, setPendingDeleteConvId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [attachOpen, setAttachOpen] = useState(false);
  const [attachedImage, setAttachedImage] = useState(null); // holds the chosen File
  // Track if there's an active scheduled purchase for the current product
  const [hasActiveScheduledPurchase, setHasActiveScheduledPurchase] = useState(false);
  
  /* VIEW UTILITIES */
  const taRef = useRef(null); // holds the <textarea> DOM node

  const autoGrow = useCallback(() => {
      const el = taRef.current;
      if (!el) return;
      el.style.height = "auto";                  // reset so scrollHeight is accurate
      el.style.height = `${el.scrollHeight}px`;  // grow to fit content
      // allow scroll only after hitting the max height (set via class)
      el.style.overflowY = el.scrollHeight > el.clientHeight ? "auto" : "hidden";
  }, []);

  useEffect(() => {
    autoGrow(); // keeps height in sync as user types/deletes
  }, [draft, autoGrow]);

  const navigate = useNavigate();         // router: for navigation
  const location = useLocation();         // router: to inspect history state
  const navigationState = location.state && typeof location.state === "object" ? location.state : null;

  // Header label
  const activeLabel = useMemo(() => {
    const c = conversations.find((c) => c.conv_id === activeConvId);
    if (c) return c.receiverName;
    if (navigationState?.receiverName) return navigationState.receiverName;
    if (navigationState?.receiverId) return `User ${navigationState.receiverId}`;
    return "Select a chat";
  }, [conversations, activeConvId, navigationState]);

  function goBackOrHome() {
    // If there is prior history in this tab, go back; otherwise go to landing
    if (location.key !== "default") {
      navigate(-1);
    } else {
      navigate("/app");                   // your landing/home route
    }
  }

  /* MOBILES */
  const [isMobileList, setIsMobileList] = useState(true);

  /* CHAT UTILITIES */
  // Handle conv query parameter to auto-open conversation
  useEffect(() => {
    const convParam = searchParams.get('conv');
    if (convParam) {
      const convId = parseInt(convParam, 10);
      if (convId && convId !== activeConvId) {
        fetchConversation(convId);
        setIsMobileList(false); // MOBILE: jump from list → chat
      }
      // Remove query parameter after handling
      setSearchParams({});
    }
  }, [searchParams, activeConvId, fetchConversation, setSearchParams]);

  // When a conversation becomes active, auto-switch to the chat pane on mobile
  useEffect(() => {
    if (activeConvId) setIsMobileList(false); // MOBILE: jump from list → chat
  }, [activeConvId]);

  // Auto-scroll to bottom when messages change or active chat switches
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [activeConvId, messages.length]);

  // Send Message
  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (attachedImage) {
        createImageMessage(draft, attachedImage);   // send as image message
      } else {
        createMessage(draft);                       // send as normal text message
      }
      setDraft("");
      setAttachedImage(null);
    }
  }
  function handleDeleteClick(convId, e) {
    e.stopPropagation(); // Prevent conversation selection
    setPendingDeleteConvId(convId);
    setDeleteConfirmOpen(true);
    setDeleteError('');
  }

  async function handleDeleteConfirm() {
    if (!pendingDeleteConvId || isDeleting) return;
    setIsDeleting(true);
    setDeleteError('');

    try {
      const API_BASE = (process.env.REACT_APP_API_BASE || 'api').replace(/\/?$/, '');
      const res = await fetch(`${API_BASE}/chat/delete_conversation.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          conv_id: pendingDeleteConvId,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to delete conversation');
      }

      const result = await res.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to delete conversation');
      }

      // Close modal and refresh conversations
      setDeleteConfirmOpen(false);
      setPendingDeleteConvId(null);
      
      // If deleted conversation was active, clear it
      if (pendingDeleteConvId === activeConvId) {
        clearActiveConversation();
      }

      // Refresh conversation list by reloading the page
      // This ensures ChatContext reloads conversations properly
      window.location.reload();
    } catch (error) {
      setDeleteError(error.message || 'Failed to delete conversation. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  }

  function handleDeleteCancel() {
    setDeleteConfirmOpen(false);
    setPendingDeleteConvId(null);
    setDeleteError('');
  }

  /* SCHEDULES AND ITEMS UTILITIES */
  const activeConversation = conversations.find(c => c.conv_id === activeConvId);
  const hasListingIntro = messages.some(m => m.metadata?.type === "listing_intro");
  const listingIntroMsg = messages.find(m => m.metadata?.type === "listing_intro");
  const isSeller = hasListingIntro && listingIntroMsg && listingIntroMsg.sender === "them";
  
  // Determine if current user is seller or buyer for header color
  const isSellerPerspective = activeConversation?.productId && activeConversation?.productSellerId && myId && 
    Number(activeConversation.productSellerId) === Number(myId);
  const headerBgColor = isSellerPerspective 
    ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
    : "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800";

  // Function to check for active scheduled purchase (extracted for reuse)
  const checkActiveScheduledPurchase = useCallback(async (signal) => {
    const productId = activeConversation?.productId;
    const isSellerPerspective = activeConversation?.productId && activeConversation?.productSellerId && myId && 
      Number(activeConversation.productSellerId) === Number(myId);
    
    // Only check if seller is viewing their own product
    if (!productId || !isSellerPerspective) {
      setHasActiveScheduledPurchase(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/scheduled-purchases/check_active.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'include',
        signal: signal,
        body: JSON.stringify({
          product_id: productId,
        }),
      });
      
      if (!res.ok) {
        console.error('Failed to check active scheduled purchase');
        setHasActiveScheduledPurchase(false);
        return;
      }
      
      const result = await res.json();
      if (result.success) {
        setHasActiveScheduledPurchase(result.has_active === true);
      } else {
        setHasActiveScheduledPurchase(false);
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error checking active scheduled purchase:', error);
        setHasActiveScheduledPurchase(false);
      }
    }
  }, [activeConversation?.productId, activeConversation?.productSellerId, myId]);

  // Check for active scheduled purchase when product changes
  useEffect(() => {
    const controller = new AbortController();
    checkActiveScheduledPurchase(controller.signal);
    
    return () => {
      controller.abort();
    };
  }, [checkActiveScheduledPurchase]);

  // Re-check for active scheduled purchases when messages change (e.g., after denial/acceptance)
  useEffect(() => {
    // Only check if we're in seller perspective and have an active conversation
    if (!activeConversation?.productId || !isSellerPerspective) {
      return;
    }
    
    const controller = new AbortController();
    // Small delay to ensure backend has processed the status change
    const timeoutId = setTimeout(() => {
      checkActiveScheduledPurchase(controller.signal);
    }, 500);
    
    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [messages.length, activeConversation?.productId, isSellerPerspective, checkActiveScheduledPurchase]);

  function handleSchedulePurchase() {
    if (!activeConvId || !activeConversation?.productId || hasActiveScheduledPurchase) return;
    navigate("/app/seller-dashboard/schedule-purchase", {
      state: {
        convId: activeConvId,
        productId: activeConversation.productId,
      }
    });
  }

  // Helper function to render a conversation item
  // sectionType: 'sellers' for "Messages To Sellers", 'buyers' for "Messages to Buyers"
  function renderConversationItem(c, sectionType = 'sellers') {
    const isActive = c.conv_id === activeConvId;
    const unread = unreadByConv?.[c.conv_id] ?? 0;
    const isHighlighted = isActive && !isMobileList; // mobile "Back" sets list view => no highlight
    
    // Check if this conversation has a listing_intro message (created via Message Seller)
    const activeMessages = isActive ? messages : [];
    const hasListingIntro = activeMessages.some(m => m.metadata?.type === "listing_intro");
    const listingIntroMsg = activeMessages.find(m => m.metadata?.type === "listing_intro");
    // If there's a listing_intro, check if current user is buyer (sender) or seller (receiver)
    const isBuyer = listingIntroMsg && listingIntroMsg.sender === "me";
    const isSeller = listingIntroMsg && listingIntroMsg.sender === "them";
    
    // Determine color based on role
    let buttonColorClass = "";
    if (isHighlighted) {
      if (hasListingIntro) {
        if (isBuyer) {
          buttonColorClass = "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
        } else if (isSeller) {
          buttonColorClass = "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300";
        } else {
          buttonColorClass = "bg-indigo-50 text-indigo-700";
        }
      } else {
        buttonColorClass = "bg-indigo-50 text-indigo-700";
      }
    }

    // Determine hover color based on section type
    const hoverColor = sectionType === 'buyers' ? "hover:bg-green-600" : "hover:bg-blue-600";

    return (
      <li key={c.conv_id} className="relative group">
        <button
          onClick={() => {
            fetchConversation(c.conv_id);
            setIsMobileList(false); // go to chat pane on mobile
          }}
          className={
            "flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition " +
            (buttonColorClass || (isHighlighted ? "bg-indigo-50 text-indigo-700" : hoverColor))
          }
          aria-current={isHighlighted ? "true" : undefined}
        >
          <div className="flex flex-col min-w-0 flex-1">
            {(c.productTitle || c.productId) && (
              <span className="truncate font-semibold text-sm">
                {c.productTitle || `Item #${c.productId}`}
              </span>
            )}
            <span className="truncate text-sm">{c.receiverName}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Product image */}
            {c.productImageUrl && (
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg overflow-hidden flex-shrink-0 bg-gray-200 dark:bg-gray-700">
                <img 
                  src={c.productImageUrl.startsWith('http') || c.productImageUrl.startsWith('/data/images/') || c.productImageUrl.startsWith('/images/') ? `${API_BASE}/image.php?url=${encodeURIComponent(c.productImageUrl)}` : c.productImageUrl}
                  alt={c.productTitle || 'Product'}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            {unread > 0 && (
              <span
                className="inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-red-600 text-white text-xs leading-5"
                aria-label={`${unread} unread`}
              >
                {unread > 99 ? "99+" : unread}
              </span>
            )}
            <div
              onClick={(e) => handleDeleteClick(c.conv_id, e)}
              className="opacity-60 hover:opacity-100 transition-opacity p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 cursor-pointer"
              aria-label="Delete conversation"
              title="Delete conversation"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleDeleteClick(c.conv_id, e);
                }
              }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
          </div>
        </button>
      </li>
    );
  }

  return (
    <div className="h-[calc(100dvh-var(--nav-h))] w-full bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100"
    style={{ "--nav-h": "64px" }}>
      <div className="mx-auto h-full max-w-[1200px] px-4 py-6">
        <div className="grid h-full grid-cols-12 gap-4">
          {/* Sidebar (Conversation List) */}
          <aside
            className={
              // MOBILE: show/hide with isMobileList; always show on md+
              `col-span-12 md:col-span-3 rounded-2xl border-4 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm ` +
              (isMobileList ? "block" : "hidden") + " md:block"
            }
          >
            <div className="border-b-4 border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Chats</h2>

              {/* Mobile-only Back button to home page */}
              <button
                onClick={goBackOrHome}                // ← go back or to /app
                className="md:hidden rounded-lg border border-gray-300 dark:border-gray-600 px-2 py-1 text-sm text-gray-700 dark:text-gray-200"
                aria-label="Back to previous page"
              >
                Back
              </button>
            </div>
            <ul
              className="max-h-[70vh] overflow-y-auto p-2"
              aria-label="Conversation list"
            >
              {convError ? (
                <li>
                  <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                    Something went wrong, please try again later
                  </div>
                </li>
              ) : (() => {
                  // Group conversations into "Messages To Sellers" (buyer) and "Messages to Buyers" (seller)
                  const messagesToSellers = [];
                  const messagesToBuyers = [];
                  
                  conversations.forEach((c) => {
                    // Determine if current user is seller or buyer
                    // If conversation has product_id and current user is seller of that product -> "Messages to Buyers"
                    // Otherwise -> "Messages To Sellers"
                    const isSellerConversation = c.productId && c.productSellerId && myId && Number(c.productSellerId) === Number(myId);
                    
                    if (isSellerConversation) {
                      messagesToBuyers.push(c);
                        } else {
                      messagesToSellers.push(c);
                      }
                  });

                    return (
                    <>
                      {/* Messages To Sellers Section */}
                      {messagesToSellers.length > 0 && (
                        <>
                          <li className="px-2 py-2">
                            <h3 className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                              Messages To Sellers
                            </h3>
                          </li>
                          {messagesToSellers.map((c) => renderConversationItem(c, 'sellers'))}
                        </>
                            )}
                      
                      {/* Messages to Buyers Section */}
                      {messagesToBuyers.length > 0 && (
                        <>
                          <li className="px-2 py-2 mt-4">
                            <h3 className="text-xs font-semibold text-green-600 dark:text-green-400 uppercase tracking-wide">
                              Messages to Buyers
                            </h3>
                          </li>
                          {messagesToBuyers.map((c) => renderConversationItem(c, 'buyers'))}
                        </>
                      )}
                    </>
                    );
                })()}
            </ul>
          </aside>

          {/* Main chat pane */}
          <section
            className={
              // MOBILE: hidden when showing list; always visible on md+
              `col-span-12 md:col-span-8 flex min-h-0 flex-col overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm ` +
              (isMobileList ? "hidden" : "flex") + " md:flex"
            }
          >
            {/* Header */}
            <div className={`relative border-4 ${headerBgColor} px-5 py-4`}>
              {/* ^ relative => allows the Back button to be absolutely positioned inside this header */}

              <div className="flex items-center justify-between">
                {/* Left: User name */}
              <div className="flex flex-col">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {activeLabel}
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Direct message</p>
                </div>

                {/* Center: Item name */}
                {(activeConversation?.productTitle || activeConversation?.productId) && (
                  <div className="flex-1 flex flex-col items-center text-center">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      {activeConversation.productTitle || `Item #${activeConversation.productId}`}
                    </h2>
              </div>
                )}

                {/* Right: Product image, View Item button and Back button (mobile) */}
                <div className="flex items-center gap-2">
                  {/* Product image */}
                  {activeConversation?.productImageUrl && (
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg overflow-hidden flex-shrink-0 bg-gray-200 dark:bg-gray-700">
                      <img 
                        src={activeConversation.productImageUrl.startsWith('http') || activeConversation.productImageUrl.startsWith('/data/images/') || activeConversation.productImageUrl.startsWith('/images/') ? `${API_BASE}/image.php?url=${encodeURIComponent(activeConversation.productImageUrl)}` : activeConversation.productImageUrl}
                        alt={activeConversation.productTitle || 'Product'}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  {activeConversation?.productId && (
                    <button
                      onClick={() => {
                        navigate(`/app/viewProduct/${activeConversation.productId}`, {
                          state: {
                            returnTo: `/app/chat?conv=${activeConvId}`
                          }
                        });
                      }}
                      className={`px-3 py-1.5 text-sm text-white rounded-lg font-medium transition-colors ${
                        isSellerPerspective
                          ? "bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600"
                          : "bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600"
                      }`}
                      aria-label="View item"
                    >
                      View Item
                    </button>
                  )}
                  {/* Mobile-only Back button */}
              <button
                onClick={() => {
                  setIsMobileList(true);
                  clearActiveConversation();
                }}
                    className="md:hidden rounded-lg border border-gray-300 dark:border-gray-600 px-2 py-1 text-sm text-gray-700 dark:text-gray-200"
                aria-label="Back to conversations"
              >
                Back
              </button>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div
              ref={scrollRef}
              className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden space-y-2 px-4 py-4"
              role="log"
              aria-live="polite"
              aria-relevant="additions"
            >
              {!activeConvId ? (
                <div className="flex h-full items-center justify-center">
                  <p className="text-sm text-gray-500">
                    Select a chat to view messages.
                  </p>
                </div>
              ) : chatByConvError[activeConvId] === true ? (
                <p className="text-center text-sm text-red-600 dark:text-red-400">
                  Something went wrong, please try again later
                </p>
              ) : messagesByConv[activeConvId] === undefined ? (
                <div className="flex h-full items-center justify-center">
                  <p className="text-sm text-gray-500">
                    Loading messages...
                  </p>
                </div>
              ) : messages.length === 0 ? (
                <p className="text-center text-sm text-gray-500">
                  No messages yet.
                </p>
              ) : (
                messages.map((m) => {
                  const messageType = m.metadata?.type;
                  const isScheduleMessage = messageType === 'schedule_request' || 
                                           messageType === 'schedule_accepted' || 
                                           messageType === 'schedule_denied' || 
                                           messageType === 'schedule_cancelled';
                  
                  return (
                    <div
                      key={m.message_id}
                      className={m.sender === "me" ? "flex justify-end" : "flex justify-start"}
                    >
                      {messageType === "listing_intro" ? (
                        <MessageCard
                          message={m}
                          isMine={m.sender === "me"}
                        />
                      ) : isScheduleMessage ? (
                        <ScheduleMessageCard
                          message={m}
                          isMine={m.sender === "me"}
                          onRespond={async () => {
                            // Refresh conversation to get updated messages
                            if (activeConvId) {
                              await fetchConversation(activeConvId);
                              // Re-check for active scheduled purchases after response
                              const controller = new AbortController();
                              await checkActiveScheduledPurchase(controller.signal);
                            }
                          }}
                        />
                      ) : (
                          // ⬇️ image vs. text bubble
                          m.image_url ? (
                            <div
                              className={
                                "max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow " +
                                (m.sender === "me" ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-900")
                              }
                            >
                              {(() => {
                                // use gated endpoint so only participants can view
                                const imgSrc = `${API_BASE}/chat/serve_chat_image.php?message_id=${m.message_id}`;
                                const dlSrc  = `${imgSrc}&download=1`; // forces download via Content-Disposition
                                return (
                                  <>
                                    <a
                                      href={imgSrc}
                                      target="_blank"
                                      rel="noopener noreferrer"   // security: stops new tab from accessing this window
                                      className="block"
                                    >
                                      <img
                                        src={imgSrc}
                                        alt="Image attachment"     // accessible description
                                        className={
                                          "max-h-72 w-full object-contain rounded-lg " +
                                          (m.sender === "me" ? "bg-white/10" : "bg-black/5")
                                        }
                                      />
                                    </a>

                                    {/* Optional caption if present */}
                                    {m.content && (
                                      <p className="mt-2 whitespace-pre-wrap break-words">{m.content}</p>
                                    )}

                                    {/* Footer: time + download */}
                                    <div
                                      className={
                                        "mt-1 flex items-center justify-between text-[10px] " +
                                        (m.sender === "me" ? "text-indigo-100" : "text-gray-500")
                                      }
                                    >
                                      <span>{fmtTime(m.ts)}</span>
                                      <a
                                        href={dlSrc}
                                        className={
                                          "ml-3 underline hover:no-underline " +
                                          (m.sender === "me" ? "text-indigo-100" : "text-gray-600")
                                        }
                                      >
                                        Download
                                      </a>
                                    </div>
                                  </>
                                );
                              })()}
                            </div>
                          ) : (
                            // Text-only bubble (unchanged)
                            <div
                              className={
                                "max-w-[80%] rounded-2xl px-4 py-2 text-sm shadow " +
                                (m.sender === "me" ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-900")
                              }
                            >
                              <p className="whitespace-pre-wrap break-words">{m.content}</p>
                              <div
                                className={
                                  "mt-1 text-[10px] " +
                                  (m.sender === "me" ? "text-indigo-100" : "text-gray-500")
                                }
                              >
                                {fmtTime(m.ts)}
                              </div>
                            </div>
                          )
                      )}
                    </div>
                  );
                })
              )}
            </div>
            {/* Composer */}
            <div className="sticky bottom-0 z-10 border-t border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800">
              {/* Schedule Purchase button (only for sellers in item-specific conversations) - above send button */}
              {isSeller && activeConversation?.productId && (
                <div className="mb-2">
                  <button
                    onClick={handleSchedulePurchase}
                    disabled={hasActiveScheduledPurchase}
                    className={`px-3 py-1.5 text-sm rounded-lg font-medium transition ${
                      hasActiveScheduledPurchase
                        ? 'bg-gray-400 cursor-not-allowed text-white'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                    title={hasActiveScheduledPurchase ? 'There is already a Scheduled Purchase for this item' : ''}
                  >
                    Schedule Purchase
                  </button>
                </div>
              )}

              {attachedImage && (
                  <div className="mb-1 flex items-center justify-between rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/40 px-3 py-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      {/* small image logo */}
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
                      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}

              <div className="flex items-center gap-2">
                {/* Attachment button */}
                <button
                  type="button"
                  onClick={() => setAttachOpen(true)}
                  aria-label="Attach a file"
                  aria-haspopup="dialog"
                  aria-expanded={attachOpen}
                  className="
                    inline-flex items-center justify-center
                    h-[44px] w-[44px]
                    rounded-xl border-2 border-gray-300 dark:border-gray-600
                    text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700
                    hover:bg-gray-50 dark:hover:bg-gray-600
                    focus:outline-none focus:ring-2 focus:ring-indigo-500
                    shrink-0
                  "
                  title="Attach"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-5 w-5"
                    aria-hidden="true"
                  >
                    <rect x="3" y="4" width="18" height="16" rx="2" />
                    <circle cx="8.5" cy="10" r="1.6" />
                    <path d="M21 16l-5.5-5.5L9 17l-3-3-3 3" />
                  </svg>
                </button>

                {/* Textarea + counter */}
                <div className="relative w-full"> {/* removed the stray ] from pb-px] */}
                  <textarea
                    ref={taRef}                           // used by your autoGrow()
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onInput={autoGrow}                    // grows with content
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message…"
                    rows={1}
                    maxLength={MAX_LEN}
                    aria-describedby="message-char-remaining"
                    wrap="soft"
                    className="
                      w-full h-auto
                      resize-none
                      rounded-xl border-2 border-gray-300 dark:border-gray-600
                      px-3 py-2.5 pr-12 text-sm leading-5
                      /* leading-5 ≈ 20px; py-2.5 ≈ 10+10 = 20; border-2 = 2+2 = 4
                        20 + 20 + 4 = 44px total to match the button */
                      min-h-[44px]                        /* guarantees baseline height = 44px */
                      focus:ring-2 focus:ring-indigo-500
                      bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                      whitespace-pre-wrap break-words
                      overflow-y-hidden
                      max-h-[28vh]
                    "
                    aria-label="Message input"
                  />
                  <span
                    id="message-char-remaining"
                    className="pointer-events-none absolute right-3 bottom-2 text-xs text-gray-500 dark:text-gray-400"
                  >
                    {MAX_LEN - draft.length}
                  </span>
                </div>
              </div>
              <ImageModal
                open={attachOpen}
                onClose={() => setAttachOpen(false)}
                onSelect={(file) => {
                  setAttachedImage(file);
                  setAttachOpen(false);
                }}
              />
            </div>

          </section>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={handleDeleteCancel}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Delete Conversation?
              </h3>
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                Are you sure you want to delete this conversation?
              </p>
              <p className="text-sm text-red-600 dark:text-red-400 font-medium mb-4">
                Warning: All scheduled purchases associated with this conversation will also be deleted.
              </p>
              {deleteError && (
                <p className="text-sm text-red-600 dark:text-red-400 mb-4">{deleteError}</p>
              )}
              <div className="flex gap-3 justify-end">
                <button
                  onClick={handleDeleteCancel}
                  disabled={isDeleting}
                  className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  disabled={isDeleting}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {isDeleting ? 'Deleting...' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
