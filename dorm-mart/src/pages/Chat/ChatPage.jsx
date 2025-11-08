import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { ChatContext } from "../../context/ChatContext";
import fmtTime from "./chat_page_utils";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import MessageCard from "./components/MessageCard";
import ScheduleMessageCard from "./components/ScheduleMessageCard";
export default function ChatPage() {
  const ctx = useContext(ChatContext);
  const {
    // chat
    conversations,
    activeConvId,
    messages,
    convError,
    chatByConvError,
    unreadByConv,
    myId,
    // actions
    fetchConversation,
    createMessage,
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

  // MOBILE: controls which pane is visible on small screens (list first)
  const [isMobileList, setIsMobileList] = useState(true);

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


  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      createMessage(draft);
      setDraft("");
    }
  }

  const navigate = useNavigate();         // router: for navigation
  const location = useLocation();         // router: to inspect history state
  const navigationState = location.state && typeof location.state === "object" ? location.state : null;

  // Header label: show the other user id for now
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

  // Get product info from active conversation (item-specific)
  const activeConversation = conversations.find(c => c.conv_id === activeConvId);
  const hasListingIntro = messages.some(m => m.metadata?.type === "listing_intro");
  const listingIntroMsg = messages.find(m => m.metadata?.type === "listing_intro");
  const isSeller = hasListingIntro && listingIntroMsg && listingIntroMsg.sender === "them";

  function handleSchedulePurchase() {
    if (!activeConvId || !activeConversation?.productId) return;
    navigate("/app/seller-dashboard/schedule-purchase", {
      state: {
        convId: activeConvId,
        productId: activeConversation.productId,
      }
    });
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
              ) : (
                  conversations.map((c) => {
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

                    return (
                      <li key={c.conv_id} className="relative group">
                        <button
                          onClick={() => {
                            fetchConversation(c.conv_id);
                            setIsMobileList(false); // go to chat pane on mobile
                          }}
                          className={
                            "flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition " +
                            (buttonColorClass || (isHighlighted ? "bg-indigo-50 text-indigo-700" : "hover:bg-blue-600"))
                          }
                          aria-current={isHighlighted ? "true" : undefined}
                        >
                          <div className="flex flex-col min-w-0 flex-1">
                            {c.productTitle && (
                              <span className="truncate font-semibold text-sm">{c.productTitle}</span>
                            )}
                            <span className="truncate text-sm">{c.receiverName}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {unread > 0 && (
                              <span
                                className="inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-red-600 text-white text-xs leading-5"
                                aria-label={`${unread} unread`}
                              >
                                {unread > 99 ? "99+" : unread}
                              </span>
                            )}
                            <button
                              onClick={(e) => handleDeleteClick(c.conv_id, e)}
                              className="opacity-60 hover:opacity-100 transition-opacity p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400"
                              aria-label="Delete conversation"
                              title="Delete conversation"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </button>
                      </li>
                    );
                  })
                  )}
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
            <div className="relative border-4 border-gray-200 dark:border-gray-700 px-5 py-4">
              {/* ^ relative => allows the Back button to be absolutely positioned inside this header */}

              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {activeLabel}
                  </h2>
                </div>

                <p className="text-xs text-gray-500 dark:text-gray-400">Direct message</p>
              </div>


              {/* Mobile-only Back button, anchored to header's bottom-right */}
              <button
                onClick={() => {
                  setIsMobileList(true);
                  clearActiveConversation();
                }}
                className="md:hidden absolute right-4 bottom-3 rounded-lg border border-gray-300 dark:border-gray-600 px-2 py-1 text-sm text-gray-700 dark:text-gray-200"
                aria-label="Back to conversations"
              >
                Back
              </button>
              {/* ^ absolute + right-4 bottom-3 => positions the button at the header's bottom-right */}
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
              ) : chatByConvError[activeConvId] ? (
                <p className="text-center text-sm text-red-600 dark:text-red-400">
                  Something went wrong, please try again later
                </p>
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
                          onRespond={() => {
                            // Refresh conversation to get updated messages
                            if (activeConvId) {
                              fetchConversation(activeConvId);
                            }
                          }}
                        />
                      ) : (
                        <div
                          className={
                            "max-w-[80%] rounded-2xl px-4 py-2 text-sm shadow " +
                            (m.sender === "me"
                              ? "bg-indigo-600 text-white"
                              : "bg-gray-100 text-gray-900")
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
                    className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
                  >
                    Schedule Purchase
                  </button>
                </div>
              )}
              
              <div className="flex items-end gap-2">
                <div className="relative w-full">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message…"
                    rows={2}
                    maxLength={MAX_LEN}
                    aria-describedby="message-char-remaining"
                    // Ensures lines wrap visually without inserting CRLF into the value
                    wrap="soft"
                    className="
                      min-h-[44px] w-full resize-y rounded-2xl
                      border border-gray-300 dark:border-gray-600
                      px-3 py-2 pr-12 pb-6 text-sm outline-none
                      focus:ring-2 focus:ring-indigo-500
                      bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                      whitespace-pre-wrap    /* allow wrapping + preserve user newlines */
                      break-words            /* break long unbroken strings to avoid overflow */
                    "
                    aria-label="Message input"
                  />
                  <span
                    id="message-char-remaining"
                    className="pointer-events-none absolute bottom-2 right-3 text-xs text-gray-500 dark:text-gray-400"
                  >
                    {MAX_LEN - draft.length}
                  </span>
                </div>

                {/* Hide on mobile; show on md+ */}
                <button
                  onClick={() => {
                    createMessage(draft);
                    setDraft("");
                  }}
                  className="hidden md:inline-flex items-center justify-center text-center h-[44px] shrink-0 rounded-2xl bg-indigo-600 px-4 text-sm font-semibold text-white shadow hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  aria-label="Send message"
                >
                  Send
                </button>

              </div>

              {/* Hide the desktop-only hint on mobile too */}
              <p className="mt-2 text-xs text-gray-500 hidden md:block">
                Press Enter to send • Shift+Enter for a new line
              </p>
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
