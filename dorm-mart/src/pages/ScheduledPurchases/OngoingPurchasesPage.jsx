import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";
import {
  withFallbackImage,
  onProductImageError,
  resolveProductPhotoUrl,
} from "../../utils/imageFallback";
import { API_BASE } from "../../utils/apiConfig";
import { csrfFetch } from "../../utils/csrfFetch";
import { formatCurrency } from "../../utils/formatters";
import {
  groupScheduledPurchasesByItem,
  loadScheduledPurchases,
} from "./utils/scheduledPurchaseUtils";

const BADGE_BASE = "px-2 py-1 text-xs font-semibold rounded";

const STATUS_BADGE_CLASSES = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  accepted: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  declined: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  cancelled:
    "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 line-through",
  expired:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  completed: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
  unsuccessful:
    "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  default: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
};

const CARD_TONES = {
  negative: {
    cardBorder: "border-red-500 dark:border-red-600",
    cardBg: "bg-red-50 dark:bg-red-900/20",
    roleBadge:
      "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300",
    metaText: "text-red-600 dark:text-red-300",
    bodyText: "text-red-700 dark:text-red-200",
    codeText: "text-red-600 dark:text-red-300",
    panelBg: "bg-red-400 dark:bg-red-500",
    inactive: true,
    redCost: true,
  },
  expired: {
    cardBorder: "border-amber-500 dark:border-amber-600",
    cardBg: "bg-amber-50 dark:bg-amber-900/20",
    roleBadge:
      "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",
    metaText: "text-amber-600 dark:text-amber-300",
    bodyText: "text-amber-700 dark:text-amber-200",
    codeText: "text-amber-600 dark:text-amber-300",
    panelBg: "bg-amber-400 dark:bg-amber-500",
    inactive: true,
    redCost: true,
  },
  completed: {
    cardBorder: "border-gray-400 dark:border-gray-600",
    cardBg: "bg-gray-50 dark:bg-gray-800/50",
    roleBadge: "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300",
    metaText: "text-gray-600 dark:text-gray-400",
    bodyText: "text-gray-600 dark:text-gray-400",
    codeText: "text-gray-500 dark:text-gray-500",
    panelBg: "bg-gray-400 dark:bg-gray-600",
    inactive: true,
  },
  buyer: {
    cardBorder: "border-green-500 dark:border-green-600",
    cardBg: "bg-green-50 dark:bg-green-900/20",
    roleBadge:
      "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300",
    metaText: "text-gray-500 dark:text-gray-400",
    bodyText: "text-gray-700 dark:text-gray-200",
    partyText: "text-gray-600 dark:text-gray-300",
    codeText: "text-blue-600 dark:text-blue-400",
    locationBg: "bg-blue-600 dark:bg-blue-800",
    meetingBg: "bg-teal-600 dark:bg-teal-700",
  },
  seller: {
    cardBorder: "border-blue-500 dark:border-blue-600",
    cardBg: "bg-blue-50 dark:bg-blue-900/20",
    roleBadge:
      "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
    metaText: "text-gray-500 dark:text-gray-400",
    bodyText: "text-gray-700 dark:text-gray-200",
    partyText: "text-gray-600 dark:text-gray-300",
    codeText: "text-blue-600 dark:text-blue-400",
    locationBg: "bg-indigo-600 dark:bg-indigo-700",
    meetingBg: "bg-purple-600 dark:bg-purple-700",
  },
};

const INFO_BOX_CLASSES = {
  red: {
    box: "bg-red-50 dark:bg-red-900/30 border-2 border-red-400 dark:border-red-700 rounded-lg p-1.5 mb-1.5",
    icon: "text-red-600 dark:text-red-300",
    label: "text-red-700 dark:text-red-200",
    detail: "text-red-600 dark:text-red-300",
  },
  amber: {
    box: "bg-amber-50 dark:bg-amber-900/30 border-2 border-amber-400 dark:border-amber-700 rounded-lg p-1.5 mb-1.5",
    icon: "text-amber-600 dark:text-amber-300",
    label: "text-amber-700 dark:text-amber-200",
    detail: "text-amber-600 dark:text-amber-300",
  },
  gray: {
    box: "bg-gray-50 dark:bg-gray-800/50 border-2 border-gray-400 dark:border-gray-600 rounded-lg p-1.5 mb-1.5",
    icon: "text-gray-600 dark:text-gray-400",
    label: "text-gray-700 dark:text-gray-300",
    detail: "text-gray-600 dark:text-gray-400",
  },
};

function getRequestState(req) {
  const isUnsuccessful = req.has_unsuccessful_confirm === true;
  const isCompleted = req.has_completed_confirm === true;

  if (isUnsuccessful) return "unsuccessful";
  if (isCompleted) return "completed";
  return req.status || "default";
}

function getStatusLabel(req) {
  const state = getRequestState(req);
  if (state === "unsuccessful") return "Unsuccessful";
  if (state === "completed") return "Completed";
  return state.charAt(0).toUpperCase() + state.slice(1);
}

function getStatusBadgeClass(req) {
  const state = getRequestState(req);
  return `${BADGE_BASE} ${STATUS_BADGE_CLASSES[state] || STATUS_BADGE_CLASSES.default}`;
}

function getCardTone(req, isBuyer) {
  const state = getRequestState(req);
  if (["declined", "cancelled", "unsuccessful"].includes(state)) {
    return CARD_TONES.negative;
  }
  if (state === "expired") return CARD_TONES.expired;
  if (state === "completed") return CARD_TONES.completed;
  return isBuyer ? CARD_TONES.buyer : CARD_TONES.seller;
}

function formatPersonName(person) {
  return `${person?.first_name || ""} ${person?.last_name || ""}`.trim();
}

function formatDateTime(value) {
  return value ? new Date(value).toLocaleString() : "";
}

function OngoingPurchasesPage() {
  const navigate = useNavigate();
  const [buyerRequests, setBuyerRequests] = useState([]);
  const [sellerRequests, setSellerRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [busyRequestId, setBusyRequestId] = useState(0);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [pendingCancelRequestId, setPendingCancelRequestId] = useState(0);

  useBodyScrollLock(cancelConfirmOpen);

  useEffect(() => {
    const abortController = new AbortController();
    async function load() {
      setLoading(true);
      setError("");
      try {
        const purchases = await loadScheduledPurchases(abortController.signal);
        setBuyerRequests(purchases.buyerRequests);
        setSellerRequests(purchases.sellerRequests);
      } catch (e) {
        if (e.name !== "AbortError") {
          setError("Unable to load your scheduled purchases right now.");
        }
      } finally {
        setLoading(false);
      }
    }

    load();
    return () => abortController.abort();
  }, []);

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const purchases = await loadScheduledPurchases();
      setBuyerRequests(purchases.buyerRequests);
      setSellerRequests(purchases.sellerRequests);
    } catch (e) {
      setError("Unable to refresh scheduled purchases.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(requestId, action) {
    setBusyRequestId(requestId);
    setActionMessage("");
    setActionError("");
    try {
      const res = await csrfFetch(`${API_BASE}/scheduled_purchases/respond.php`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          request_id: requestId,
          action,
        }),
      });
      if (!res.ok) {
        const msg =
          action === "accept"
            ? "Failed to accept request"
            : "Failed to decline request";
        throw new Error(msg);
      }
      const payload = await res.json();
      if (!payload.success) {
        throw new Error(payload.error || "Action failed");
      }

      const updated = payload.data;
      // Update in buyer requests - preserve has_completed_confirm
      setBuyerRequests((prev) =>
        prev.map((req) => {
          if (req.request_id !== requestId) return req;
          return {
            ...req,
            status: updated.status || req.status,
            buyer_response_at:
              updated.buyer_response_at || new Date().toISOString(),
            meeting_at: updated.meeting_at || req.meeting_at,
            meet_location: updated.meet_location || req.meet_location,
            verification_code:
              updated.verification_code || req.verification_code,
            has_completed_confirm: req.has_completed_confirm, // Preserve completed status
          };
        }),
      );
      // Also refresh seller requests to get updated status
      const sellerRes = await fetch(
        `${API_BASE}/scheduled_purchases/list_seller.php`,
        {
          method: "GET",
          headers: { Accept: "application/json" },
          credentials: "include",
        },
      );
      if (sellerRes.ok) {
        const sellerPayload = await sellerRes.json();
        if (sellerPayload.success) {
          setSellerRequests(
            Array.isArray(sellerPayload.data) ? sellerPayload.data : [],
          );
        }
      }
      setActionMessage(
        action === "accept"
          ? "Purchase accepted. Be sure to share the verification code when you meet."
          : "Purchase declined.",
      );
    } catch (e) {
      setActionError(e.message || "Something went wrong.");
    } finally {
      setBusyRequestId(0);
    }
  }

  // Group all purchases by item (inventory_product_id), partition into schedule buckets, sort
  const groupedByItem = useMemo(() => {
    return groupScheduledPurchasesByItem(
      buyerRequests,
      sellerRequests,
      Date.now(),
    );
  }, [buyerRequests, sellerRequests]);

  // Helper function to render cost/trade information
  const renderCostTradeInfo = (req, tone) => {
    const isCompleted = getRequestState(req) === "completed";
    const isRedCost = tone.redCost === true;

    if (req.is_trade && req.trade_item_description) {
      return (
        <div
          className={`${isRedCost ? "bg-red-100 dark:bg-red-900/50 border-red-500" : isCompleted ? "bg-gray-100 dark:bg-gray-800/50 border-gray-400 dark:border-gray-600" : "bg-amber-50 dark:bg-amber-900/30 border-amber-400 dark:border-amber-700"} border-4 rounded-lg p-2 my-1.5 shadow-lg min-w-0 overflow-hidden`}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <svg
              className={`w-5 h-5 ${isRedCost ? "text-red-700 dark:text-red-200" : isCompleted ? "text-gray-600 dark:text-gray-400" : "text-amber-600 dark:text-amber-300"}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
              />
            </svg>
            <span
              className={`text-sm font-bold uppercase tracking-wide ${isRedCost ? "text-red-700 dark:text-red-200" : isCompleted ? "text-gray-600 dark:text-gray-400" : "text-amber-700 dark:text-amber-200"}`}
            >
              TRADE
            </span>
          </div>
          <p
            className={`text-sm font-semibold min-w-0 break-words break-all overflow-wrap-anywhere ${isRedCost ? "text-red-800 dark:text-red-100" : isCompleted ? "text-gray-700 dark:text-gray-300" : "text-amber-800 dark:text-amber-100"}`}
            style={{ wordBreak: "break-all", overflowWrap: "anywhere" }}
          >
            {req.trade_item_description}
          </p>
        </div>
      );
    } else if (
      req.negotiated_price !== null &&
      req.negotiated_price !== undefined
    ) {
      return (
        <div
          className={`${isRedCost ? "bg-red-500 dark:bg-red-600" : isCompleted ? "bg-gray-500 dark:bg-gray-600" : "bg-emerald-600 dark:bg-emerald-700"} border-4 ${isRedCost ? "border-red-400" : isCompleted ? "border-gray-400 dark:border-gray-500" : "border-emerald-500"} rounded-lg p-2 my-1.5 shadow-lg`}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <svg
              className="w-5 h-5 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="text-sm font-bold uppercase tracking-wide text-white">
              Negotiated Price
            </span>
          </div>
          <p className="text-2xl font-bold text-white">
            {formatCurrency(req.negotiated_price) ?? "$0.00"}
          </p>
        </div>
      );
    } else if (
      req.item?.listing_price !== null &&
      req.item?.listing_price !== undefined
    ) {
      return (
        <div
          className={`${isRedCost ? "bg-red-500 dark:bg-red-600" : isCompleted ? "bg-gray-500 dark:bg-gray-600" : "bg-blue-600 dark:bg-blue-800"} border-4 ${isRedCost ? "border-red-400" : isCompleted ? "border-gray-400 dark:border-gray-500" : "border-blue-500"} rounded-lg p-2 my-1.5 shadow-lg`}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <svg
              className="w-5 h-5 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="text-sm font-bold uppercase tracking-wide text-white">
              Listed Price
            </span>
          </div>
          <p className="text-2xl font-bold text-white">
            {formatCurrency(req.item.listing_price) ?? "$0.00"}
          </p>
        </div>
      );
    }
    return null;
  };

  const renderStatusInfoBox = ({
    color = "red",
    label,
    detail = "",
    title = "",
    icon = "x",
  }) => {
    const classes = INFO_BOX_CLASSES[color] || INFO_BOX_CLASSES.red;
    const iconPath =
      icon === "check"
        ? "M5 13l4 4L19 7"
        : icon === "clock"
          ? "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          : "M6 18L18 6M6 6l12 12";

    return (
      <div className={classes.box}>
        <div className="flex items-center gap-1.5 flex-wrap">
          <svg
            className={`w-4 h-4 ${classes.icon}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d={iconPath}
            />
          </svg>
          <span className={`text-sm font-bold ${classes.label}`}>
            {label}
          </span>
          {detail && (
            <span
              className={`text-sm ${classes.detail} ${title ? "truncate min-w-0" : ""}`}
              title={title}
            >
              {detail}
            </span>
          )}
        </div>
      </div>
    );
  };

  const renderRequestStateInfo = (req) => {
    const state = getRequestState(req);
    if (state === "completed") {
      return renderStatusInfoBox({
        color: "gray",
        label: "COMPLETED",
        icon: "check",
      });
    }
    if (state === "cancelled") {
      const canceledBy = req.canceled_by || {};
      const canceledByName =
        formatPersonName(canceledBy) ||
        (canceledBy.user_id ? `User ${canceledBy.user_id}` : "Unknown");
      return renderStatusInfoBox({
        label: "CANCELLED",
        detail: `by ${canceledByName}`,
        title: canceledByName,
      });
    }
    if (state === "declined") {
      return renderStatusInfoBox({ label: "DECLINED" });
    }
    if (state === "unsuccessful") {
      return renderStatusInfoBox({
        label: "UNSUCCESSFUL",
        detail: "Schedule a new purchase before confirming again.",
      });
    }
    if (state === "expired") {
      return renderStatusInfoBox({
        color: "amber",
        label: "EXPIRED",
        detail: "No response received in time",
        icon: "clock",
      });
    }
    return null;
  };

  // Helper function to render next steps info for accepted purchases
  const renderNextStepsInfo = (req) => {
    if (
      req.status === "accepted" &&
      req.has_completed_confirm !== true &&
      req.has_unsuccessful_confirm !== true
    ) {
      return (
        <div className="bg-orange-50 dark:bg-orange-900/30 border-2 border-orange-400 dark:border-orange-600 rounded-lg p-2 mb-1.5">
          <div className="flex items-start gap-1.5">
            <svg
              className="w-4 h-4 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-semibold text-orange-800 dark:text-orange-200 mb-0.5">
                Next Steps
              </p>
              <p className="text-sm text-orange-700 dark:text-orange-300">
                Meet in-person at this agreed upon time and location to complete
                the exchange. Remember to use the verification code to verify
                identities! Once the exchange is done, the seller will send the
                Confirm Purchase form.
              </p>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  // Component to render a purchase card
  const PurchaseCard = ({ req, perspective }) => {
    const isBuyer = perspective === "buyer";
    const meetingDate = req.meeting_at
      ? formatDateTime(req.meeting_at)
      : "Not provided";
    const otherParty = isBuyer ? req.seller : req.buyer;
    const otherPartyName = formatPersonName(otherParty);
    const code = req.verification_code || "----";
    const canRespond = req.status === "pending" && isBuyer;
    const state = getRequestState(req);
    const tone = getCardTone(req, isBuyer);
    const isCompleted = state === "completed";
    const canCancel =
      (req.status === "pending" || req.status === "accepted") &&
      !tone.inactive;
    const locationBg = tone.locationBg || tone.panelBg;
    const meetingBg = tone.meetingBg || tone.panelBg;
    const bodyText = tone.partyText || tone.bodyText;
    const acceptedCodeText = "text-green-600 dark:text-green-400";
    const codeText =
      state === "accepted" ? acceptedCodeText : tone.codeText;

    return (
      <div
        className={`${tone.cardBg} border-2 ${tone.cardBorder} rounded-lg p-2 shadow-sm ${tone.inactive ? "opacity-75" : ""} min-w-0 overflow-hidden`}
      >
        <div className="flex flex-col gap-1.5 min-w-0">
          {/* Header with perspective badge and status */}
          <div className="flex items-center justify-between flex-wrap gap-1.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className={`${BADGE_BASE} ${tone.roleBadge}`}
              >
                You are the {isBuyer ? "Buyer" : "Seller"}
              </span>
              <span className={getStatusBadgeClass(req)}>
                {getStatusLabel(req)}
              </span>
            </div>
            <div className={`text-sm ${tone.metaText}`}>
              {isBuyer ? "Requested" : "Created"}{" "}
              {formatDateTime(req.created_at)}
              {req.buyer_response_at && (
                <div>
                  {isBuyer ? "You responded" : "Buyer responded"}{" "}
                  {formatDateTime(req.buyer_response_at)}
                </div>
              )}
            </div>
          </div>

          {renderRequestStateInfo(req)}

          {/* Next Steps info for accepted purchases */}
          {renderNextStepsInfo(req)}

          {/* Other party */}
          <div className="min-w-0">
            <p
              className={`text-sm truncate min-w-0 ${bodyText}`}
              title={otherPartyName}
            >
              {isBuyer ? "Seller" : "Buyer"}:{" "}
              {otherPartyName}
            </p>
          </div>

          {/* Cost/Trade Information */}
          {renderCostTradeInfo(req, tone)}

          {/* Location and Meeting Time */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 my-1.5">
            <div className={`${locationBg} rounded-lg p-2 shadow-md`}>
              <div className="flex items-center gap-1.5 mb-1">
                <svg
                  className="w-4 h-4 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                <span
                  className="text-xs font-semibold uppercase tracking-wide text-white"
                >
                  Location
                </span>
              </div>
              <p
                className="text-base font-bold truncate text-white"
                title={req.meet_location || "Not provided"}
              >
                {req.meet_location || "Not provided"}
              </p>
            </div>
            <div className={`${meetingBg} rounded-lg p-2 shadow-md`}>
              <div className="flex items-center gap-1.5 mb-1">
                <svg
                  className="w-4 h-4 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <span
                  className="text-xs font-semibold uppercase tracking-wide text-white"
                >
                  Meeting Time
                </span>
              </div>
              <p className="text-base font-bold text-white">
                {meetingDate}
              </p>
            </div>
          </div>

          {/* Description */}
          {req.description && (
            <div
              className={`text-sm break-words overflow-wrap-anywhere ${tone.bodyText}`}
            >
              <span className="font-semibold">Description:</span>{" "}
              {req.description}
            </div>
          )}

          {/* Verification Code */}
          <div className={`text-sm ${tone.bodyText}`}>
            <span className="font-semibold">Verification Code:</span>{" "}
            <span
              className={`font-mono text-base ${codeText}`}
            >
              {code}
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-1.5 justify-end">
            {canRespond && (
              <>
                <button
                  type="button"
                  onClick={() => handleAction(req.request_id, "decline")}
                  disabled={busyRequestId === req.request_id}
                  className="px-3 py-1.5 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600 disabled:opacity-60"
                >
                  {busyRequestId === req.request_id && actionError
                    ? "Retry Decline"
                    : "Decline"}
                </button>
                <button
                  type="button"
                  onClick={() => handleAction(req.request_id, "accept")}
                  disabled={busyRequestId === req.request_id}
                  className="px-3 py-1.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {busyRequestId === req.request_id && !actionError
                    ? "Processing..."
                    : "Accept"}
                </button>
              </>
            )}

            {/* Cancel button - hidden when buyer has Decline/Accept */}
            {canCancel && !canRespond && (
              <button
                type="button"
                onClick={() => {
                  setPendingCancelRequestId(req.request_id);
                  setCancelConfirmOpen(true);
                  setActionError("");
                }}
                disabled={busyRequestId === req.request_id}
                className="px-3 py-1.5 text-sm font-medium rounded-lg border border-orange-500 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            )}

            {/* Review button for completed purchases (buyer only) */}
            {isBuyer &&
              isCompleted &&
              req.inventory_product_id &&
              (req.has_review ? (
                <button
                  type="button"
                  onClick={() => {
                    navigate(
                      `/app/purchase-history?review=${encodeURIComponent(req.inventory_product_id)}`,
                    );
                  }}
                  className="px-3 py-1.5 text-sm font-medium rounded-lg bg-gray-500 text-white hover:bg-gray-600 dark:bg-gray-600 dark:hover:bg-gray-500"
                >
                  View Review
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    navigate(
                      `/app/purchase-history?review=${encodeURIComponent(req.inventory_product_id)}`,
                    );
                  }}
                  className="px-3 py-1.5 text-sm font-medium rounded-lg bg-purple-600 text-white hover:bg-purple-700 dark:bg-purple-700 dark:hover:bg-purple-600"
                >
                  Leave a Review
                </button>
              ))}
          </div>
        </div>
      </div>
    );
  };

  // Item row (thumbnail + title) and cards for one bucket only; section title is page-level.
  const renderItemGroupForBucket = (itemGroup, bucketKey) => {
    const requests = itemGroup?.buckets?.[bucketKey];
    if (!requests?.length) return null;

    const photos = Array.isArray(itemGroup.item?.photos)
      ? itemGroup.item.photos
      : [];
    const thumbUrl =
      photos.length > 0
        ? resolveProductPhotoUrl(photos[0], {
            apiBase: API_BASE,
            proxyUnknown: true,
          })
        : null;
    const thumbSrc = withFallbackImage(thumbUrl);

    return (
      <div key={`${itemGroup.productId}-${bucketKey}`} className="min-w-0">
        <div className="flex items-center gap-3 mb-3">
          <img
            src={thumbSrc}
            alt={itemGroup.item.title || "Item"}
            onError={onProductImageError}
            className="w-8 h-8 rounded object-cover flex-shrink-0 border border-gray-200 dark:border-gray-600"
          />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 break-words overflow-wrap-anywhere">
            {itemGroup.item.title || "Unknown Item"}
          </h3>
        </div>
        <div className="space-y-3">
          {requests.map((req) => (
            <PurchaseCard
              key={`${req.perspective}-${req.request_id}`}
              req={req}
              perspective={req.perspective}
            />
          ))}
        </div>
      </div>
    );
  };

  /** Single page-level heading per bucket; underneath, item groups (title repeated per item, not the bucket name) */
  const renderGlobalBucketSection = (title, bucketKey) => {
    const groupsWithCards = groupedByItem.filter(
      (g) => (g.buckets?.[bucketKey]?.length ?? 0) > 0,
    );
    if (groupsWithCards.length === 0) return null;
    return (
      <section className="space-y-4" aria-labelledby={`section-${bucketKey}`}>
        <h2
          id={`section-${bucketKey}`}
          className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 pb-2"
        >
          {title}
        </h2>
        <div className="space-y-8">
          {groupsWithCards.map((g) => renderItemGroupForBucket(g, bucketKey))}
        </div>
      </section>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Ongoing Purchases
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-300">
            Review scheduled meetup requests.
          </p>
        </div>

        {actionMessage && (
          <div className="mb-4 text-sm text-green-600 dark:text-green-400">
            {actionMessage}
          </div>
        )}
        {actionError && (
          <div className="mb-4 text-sm text-red-600 dark:text-red-400">
            {actionError}
          </div>
        )}

        {loading ? (
          <div className="text-gray-600 dark:text-gray-300">
            Loading scheduled purchases...
          </div>
        ) : groupedByItem.length === 0 ? (
          <div className="text-gray-600 dark:text-gray-400">
            You have no scheduled purchases yet.
          </div>
        ) : (
          <div className="space-y-10">
            {renderGlobalBucketSection("Happening now", "active")}
            {renderGlobalBucketSection("Needs response", "needsResponse")}
            {renderGlobalBucketSection("Upcoming", "upcoming")}
            {renderGlobalBucketSection("Past", "past")}
          </div>
        )}

        {error && (
          <div className="mt-6 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Cancel Confirmation Modal */}
        {cancelConfirmOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            onClick={() => {
              setCancelConfirmOpen(false);
              setPendingCancelRequestId(0);
            }}
          >
            <div
              className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Cancel Scheduled Purchase?
                </h3>
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                  Are you sure you want to cancel? This action cannot be undone.
                </p>
                {actionError && (
                  <p className="text-sm text-red-600 dark:text-red-400 mb-4">
                    {actionError}
                  </p>
                )}
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => {
                      setCancelConfirmOpen(false);
                      setPendingCancelRequestId(0);
                      setActionError("");
                    }}
                    disabled={busyRequestId === pendingCancelRequestId}
                    className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                  >
                    No, Keep It
                  </button>
                  <button
                    onClick={async () => {
                      if (!pendingCancelRequestId) return;
                      setBusyRequestId(pendingCancelRequestId);
                      setActionError("");
                      try {
                        const res = await csrfFetch(
                          `${API_BASE}/scheduled_purchases/cancel.php`,
                          {
                            method: "POST",
                            headers: {
                              "Content-Type": "application/json",
                              Accept: "application/json",
                            },
                            credentials: "include",
                            body: JSON.stringify({
                              request_id: pendingCancelRequestId,
                            }),
                          },
                        );
                        if (!res.ok) {
                          throw new Error("Failed to cancel request");
                        }
                        const payload = await res.json();
                        if (!payload.success) {
                          throw new Error(payload.error || "Failed to cancel");
                        }
                        setCancelConfirmOpen(false);
                        setPendingCancelRequestId(0);
                        await refresh();
                        setActionMessage(
                          "Purchase request cancelled successfully.",
                        );
                      } catch (e) {
                        setActionError(e.message || "Something went wrong.");
                      } finally {
                        setBusyRequestId(0);
                      }
                    }}
                    disabled={busyRequestId === pendingCancelRequestId}
                    className="px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {busyRequestId === pendingCancelRequestId
                      ? "Cancelling..."
                      : "Yes, Cancel"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default OngoingPurchasesPage;
