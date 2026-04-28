import {
  coerceBoolean,
  coerceNumber,
  formatCurrency,
  formatDateTime,
  humanizeStatus,
  parseDateValue,
} from "../../../utils/formatters";

const FAILURE_REASON_LABELS = {
  buyer_no_show: "Buyer no showed",
  insufficient_funds: "Buyer did not have enough money",
  other: "Other",
};

export function normalizeReceiptDetails(receiptData, normalizedProduct) {
  if (!receiptData) return null;

  const src = receiptData || {};
  const finalPrice =
    coerceNumber(
      src.final_price ??
        src.finalPrice ??
        src.purchase_price ??
        src.amount_paid ??
        src.price_paid ??
        src.total_paid ??
        src.price,
    ) ?? null;
  const negotiatedPrice =
    coerceNumber(
      src.negotiated_price ??
        src.negotiatedPrice ??
        src.agreed_price ??
        src.default_final_price ??
        src.original_price ??
        src.snapshot?.negotiated_price,
    ) ?? null;
  const meetingAt = parseDateValue(
    src.meeting_at ??
      src.meetingAt ??
      src.meeting_time ??
      src.met_at ??
      src.meet_at ??
      src.meet_time ??
      src.snapshot?.meeting_at,
  );
  const purchaseDate = parseDateValue(
    src.purchase_date ??
      src.purchased_at ??
      src.confirmed_at ??
      src.completed_at ??
      src.closed_at ??
      src.date_sold ??
      src.dateSold ??
      src.snapshot?.meeting_at ??
      normalizedProduct?.dateSold ??
      meetingAt ??
      src.buyer_response_at ??
      src.updated_at ??
      src.created_at,
  );
  const failureReason =
    src.failure_reason ??
    src.failureReason ??
    src.reason ??
    src.reason_code ??
    null;
  const failureReasonNotes =
    src.failure_reason_notes ??
    src.failureReasonNotes ??
    src.reason_notes ??
    null;
  const sellerNotes =
    src.seller_notes ?? src.sellerNotes ?? src.notes ?? src.description ?? null;
  const buyerNotes = src.buyer_notes ?? src.buyerNotes ?? null;
  const extraComments =
    src.comments ?? src.additional_comments ?? src.additionalComments ?? null;
  const meetLocation =
    src.meet_location ??
    src.meeting_location ??
    src.location ??
    src.snapshot?.meet_location ??
    normalizedProduct?.itemLocation ??
    null;
  const buyerName =
    src.buyer_name ?? src.buyerName ?? src.snapshot?.buyer_name ?? null;
  const sellerName =
    src.seller_name ?? src.sellerName ?? normalizedProduct?.sellerName ?? null;
  const buyerId =
    src.buyer_user_id ??
    src.buyerUserId ??
    src.buyer_id ??
    src.snapshot?.buyer_id ??
    null;
  const sellerId =
    src.seller_user_id ??
    src.sellerUserId ??
    src.seller_id ??
    normalizedProduct?.sellerId ??
    null;
  const tradeItemDescription =
    src.trade_item_description ??
    src.tradeItemDescription ??
    src.snapshot?.trade_item_description ??
    null;
  const isTrade = coerceBoolean(
    src.is_trade ?? src.trade ?? src.snapshot?.is_trade,
  );
  const receiptId = src.receipt_id ?? src.receiptId ?? null;

  return {
    receiptId,
    finalPrice,
    negotiatedPrice,
    meetLocation,
    meetingAt,
    purchaseDate,
    buyerName,
    sellerName,
    buyerId,
    sellerId,
    comments: extraComments,
    sellerNotes,
    buyerNotes,
    failureReason,
    failureReasonLabel: failureReason
      ? (FAILURE_REASON_LABELS[failureReason] ?? humanizeStatus(failureReason))
      : null,
    failureReasonNotes,
    tradeItemDescription,
    isTrade: isTrade === true,
  };
}

export function buildPurchaseRows(details) {
  if (!details) return [];

  const rows = [];
  const addRow = (label, value, options = {}) => {
    const { showPlaceholder = false, placeholder = "\u2014" } = options;
    if (value === null || value === undefined || value === "") {
      if (showPlaceholder) {
        rows.push({ label, value: placeholder });
      }
      return;
    }
    rows.push({ label, value });
  };

  addRow("Receipt #", details.receiptId ? `#${details.receiptId}` : null, {
    showPlaceholder: true,
  });
  addRow(
    "Purchase date",
    details.purchaseDate ? formatDateTime(details.purchaseDate) : null,
    { showPlaceholder: true },
  );
  addRow("Meeting location", details.meetLocation || null, {
    showPlaceholder: true,
  });
  addRow(
    "Final price",
    details.finalPrice != null ? formatCurrency(details.finalPrice) : null,
  );
  if (
    details.negotiatedPrice != null &&
    details.negotiatedPrice !== details.finalPrice
  ) {
    addRow("Negotiated price", formatCurrency(details.negotiatedPrice));
  }
  addRow(
    "Buyer",
    details.buyerName || (details.buyerId ? `Buyer #${details.buyerId}` : null),
    {
      showPlaceholder: true,
    },
  );
  addRow(
    "Seller",
    details.sellerName ||
      (details.sellerId ? `Seller #${details.sellerId}` : null),
    {
      showPlaceholder: true,
    },
  );
  addRow(
    "Trade item",
    details.tradeItemDescription || (details.isTrade ? "Trade involved" : null),
  );

  return rows;
}
