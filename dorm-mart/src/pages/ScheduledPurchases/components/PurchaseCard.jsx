import { formatCurrency } from "../../../utils/formatters";
import {
  BADGE_BASE,
  INFO_BOX_CLASSES,
  formatPersonName,
  formatPurchaseDateTime,
  getCardTone,
  getRequestState,
  getStatusBadgeClass,
  getStatusLabel,
} from "../utils/ongoingPurchaseViewUtils";

function StatusInfoBox({
  color = "red",
  label,
  detail = "",
  title = "",
  icon = "x",
}) {
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
        <span className={`text-sm font-bold ${classes.label}`}>{label}</span>
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
}

function CostTradeInfo({ req, tone }) {
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
  }

  const hasNegotiatedPrice =
    req.negotiated_price !== null && req.negotiated_price !== undefined;
  const hasListedPrice =
    req.item?.listing_price !== null && req.item?.listing_price !== undefined;
  if (!hasNegotiatedPrice && !hasListedPrice) return null;

  const isNegotiated = hasNegotiatedPrice;
  const price = isNegotiated ? req.negotiated_price : req.item.listing_price;
  const title = isNegotiated ? "Negotiated Price" : "Listed Price";
  const bg = isRedCost
    ? "bg-red-500 dark:bg-red-600"
    : isCompleted
      ? "bg-gray-500 dark:bg-gray-600"
      : isNegotiated
        ? "bg-emerald-600 dark:bg-emerald-700"
        : "bg-blue-600 dark:bg-blue-800";
  const border = isRedCost
    ? "border-red-400"
    : isCompleted
      ? "border-gray-400 dark:border-gray-500"
      : isNegotiated
        ? "border-emerald-500"
        : "border-blue-500";

  return (
    <div className={`${bg} border-4 ${border} rounded-lg p-2 my-1.5 shadow-lg`}>
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
          {title}
        </span>
      </div>
      <p className="text-2xl font-bold text-white">
        {formatCurrency(price) ?? "$0.00"}
      </p>
    </div>
  );
}

function RequestStateInfo({ req }) {
  const state = getRequestState(req);
  if (state === "completed") {
    return <StatusInfoBox color="gray" label="COMPLETED" icon="check" />;
  }
  if (state === "cancelled") {
    const canceledBy = req.canceled_by || {};
    const canceledByName =
      formatPersonName(canceledBy) ||
      (canceledBy.user_id ? `User ${canceledBy.user_id}` : "Unknown");
    return (
      <StatusInfoBox
        label="CANCELLED"
        detail={`by ${canceledByName}`}
        title={canceledByName}
      />
    );
  }
  if (state === "declined") return <StatusInfoBox label="DECLINED" />;
  if (state === "unsuccessful") {
    return (
      <StatusInfoBox
        label="UNSUCCESSFUL"
        detail="Schedule a new purchase before confirming again."
      />
    );
  }
  if (state === "expired") {
    return (
      <StatusInfoBox
        color="amber"
        label="EXPIRED"
        detail="No response received in time"
        icon="clock"
      />
    );
  }
  return null;
}

function NextStepsInfo({ req }) {
  if (
    req.status !== "accepted" ||
    req.has_completed_confirm === true ||
    req.has_unsuccessful_confirm === true
  ) {
    return null;
  }

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

export default function PurchaseCard({
  req,
  perspective,
  actionError,
  busyRequestId,
  onAction,
  onCancel,
  onOpenPurchaseHistory,
}) {
  const isBuyer = perspective === "buyer";
  const meetingDate = req.meeting_at
    ? formatPurchaseDateTime(req.meeting_at)
    : "Not provided";
  const otherParty = isBuyer ? req.seller : req.buyer;
  const otherPartyName = formatPersonName(otherParty);
  const code = req.verification_code || "----";
  const canRespond = req.status === "pending" && isBuyer;
  const state = getRequestState(req);
  const tone = getCardTone(req, isBuyer);
  const isCompleted = state === "completed";
  const canCancel =
    (req.status === "pending" || req.status === "accepted") && !tone.inactive;
  const locationBg = tone.locationBg || tone.panelBg;
  const meetingBg = tone.meetingBg || tone.panelBg;
  const bodyText = tone.partyText || tone.bodyText;
  const codeText =
    state === "accepted" ? "text-green-600 dark:text-green-400" : tone.codeText;

  return (
    <div
      className={`${tone.cardBg} border-2 ${tone.cardBorder} rounded-lg p-2 shadow-sm ${tone.inactive ? "opacity-75" : ""} min-w-0 overflow-hidden`}
    >
      <div className="flex flex-col gap-1.5 min-w-0">
        <div className="flex items-center justify-between flex-wrap gap-1.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`${BADGE_BASE} ${tone.roleBadge}`}>
              You are the {isBuyer ? "Buyer" : "Seller"}
            </span>
            <span className={getStatusBadgeClass(req)}>
              {getStatusLabel(req)}
            </span>
          </div>
          <div className={`text-sm ${tone.metaText}`}>
            {isBuyer ? "Requested" : "Created"}{" "}
            {formatPurchaseDateTime(req.created_at)}
            {req.buyer_response_at && (
              <div>
                {isBuyer ? "You responded" : "Buyer responded"}{" "}
                {formatPurchaseDateTime(req.buyer_response_at)}
              </div>
            )}
          </div>
        </div>

        <RequestStateInfo req={req} />
        <NextStepsInfo req={req} />

        <div className="min-w-0">
          <p className={`text-sm truncate min-w-0 ${bodyText}`} title={otherPartyName}>
            {isBuyer ? "Seller" : "Buyer"}: {otherPartyName}
          </p>
        </div>

        <CostTradeInfo req={req} tone={tone} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 my-1.5">
          <div className={`${locationBg} rounded-lg p-2 shadow-md`}>
            <div className="flex items-center gap-1.5 mb-1">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-xs font-semibold uppercase tracking-wide text-white">
                Location
              </span>
            </div>
            <p className="text-base font-bold truncate text-white" title={req.meet_location || "Not provided"}>
              {req.meet_location || "Not provided"}
            </p>
          </div>
          <div className={`${meetingBg} rounded-lg p-2 shadow-md`}>
            <div className="flex items-center gap-1.5 mb-1">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-xs font-semibold uppercase tracking-wide text-white">
                Meeting Time
              </span>
            </div>
            <p className="text-base font-bold text-white">{meetingDate}</p>
          </div>
        </div>

        {req.description && (
          <div className={`text-sm break-words overflow-wrap-anywhere ${tone.bodyText}`}>
            <span className="font-semibold">Description:</span> {req.description}
          </div>
        )}

        <div className={`text-sm ${tone.bodyText}`}>
          <span className="font-semibold">Verification Code:</span>{" "}
          <span className={`font-mono text-base ${codeText}`}>{code}</span>
        </div>

        <div className="flex flex-wrap gap-1.5 justify-end">
          {canRespond && (
            <>
              <button
                type="button"
                onClick={() => onAction(req.request_id, "decline")}
                disabled={busyRequestId === req.request_id}
                className="px-3 py-1.5 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600 disabled:opacity-60"
              >
                {busyRequestId === req.request_id && actionError
                  ? "Retry Decline"
                  : "Decline"}
              </button>
              <button
                type="button"
                onClick={() => onAction(req.request_id, "accept")}
                disabled={busyRequestId === req.request_id}
                className="px-3 py-1.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {busyRequestId === req.request_id && !actionError
                  ? "Processing..."
                  : "Accept"}
              </button>
            </>
          )}

          {canCancel && !canRespond && (
            <button
              type="button"
              onClick={() => onCancel(req.request_id)}
              disabled={busyRequestId === req.request_id}
              className="px-3 py-1.5 text-sm font-medium rounded-lg border border-orange-500 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
          )}

          {isBuyer &&
            isCompleted &&
            req.inventory_product_id &&
            (req.has_review ? (
              <button
                type="button"
                onClick={() => onOpenPurchaseHistory(req.inventory_product_id)}
                className="px-3 py-1.5 text-sm font-medium rounded-lg bg-gray-500 text-white hover:bg-gray-600 dark:bg-gray-600 dark:hover:bg-gray-500"
              >
                View Review
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onOpenPurchaseHistory(req.inventory_product_id)}
                className="px-3 py-1.5 text-sm font-medium rounded-lg bg-purple-600 text-white hover:bg-purple-700 dark:bg-purple-700 dark:hover:bg-purple-600"
              >
                Leave a Review
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}
