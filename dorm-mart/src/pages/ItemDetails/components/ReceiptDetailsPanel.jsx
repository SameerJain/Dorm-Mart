import {
  formatCurrency,
  formatDateTime,
  humanizeStatus,
} from "../../../utils/formatters";

export default function ReceiptDetailsPanel({ purchaseDetails, purchaseRows }) {
  if (!purchaseDetails) return null;

  const visibleRows = purchaseRows.filter((row) => {
    return (
      row.label !== "Receipt #" &&
      row.label !== "Purchase date" &&
      row.label !== "Final price" &&
      row.label !== "Negotiated price"
    );
  });

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200/70 dark:border-gray-700/70 shadow-sm p-4 w-full space-y-3">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wide">
        Transaction Details
      </h3>

      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        {purchaseDetails.finalPrice != null && (
          <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {formatCurrency(purchaseDetails.finalPrice) ??
              `$${Number(purchaseDetails.finalPrice).toFixed(2)}`}
          </span>
        )}
        {purchaseDetails.negotiatedPrice != null &&
          purchaseDetails.negotiatedPrice !== purchaseDetails.finalPrice && (
            <span className="text-sm text-gray-500 dark:text-gray-400 line-through">
              {formatCurrency(purchaseDetails.negotiatedPrice)}
            </span>
          )}
        {purchaseDetails.purchaseDate && (
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {formatDateTime(purchaseDetails.purchaseDate)}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
        {visibleRows.map((row, idx) => (
          <div key={`${row.label}-${idx}`} className="flex items-start gap-2">
            <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide pt-0.5 flex-shrink-0">
              {row.label}
            </span>
            <span className="text-gray-800 dark:text-gray-200 font-medium truncate">
              {row.value ?? "\u2014"}
            </span>
          </div>
        ))}
      </div>

      {purchaseDetails.failureReason && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-md p-3">
          <p className="text-xs text-red-600 dark:text-red-400 uppercase tracking-wide mb-0.5">
            Failure Reason
          </p>
          <p className="text-sm font-semibold text-red-800 dark:text-red-200">
            {purchaseDetails.failureReasonLabel ||
              humanizeStatus(purchaseDetails.failureReason)}
          </p>
          {purchaseDetails.failureReasonNotes && (
            <p className="text-sm text-red-700 dark:text-red-300 whitespace-pre-wrap mt-1">
              {purchaseDetails.failureReasonNotes}
            </p>
          )}
        </div>
      )}

      {purchaseDetails.sellerNotes ? (
        <NoteBlock title="Seller notes" text={purchaseDetails.sellerNotes} />
      ) : null}
      {purchaseDetails.buyerNotes ? (
        <NoteBlock title="Buyer comments" text={purchaseDetails.buyerNotes} />
      ) : null}
      {purchaseDetails.comments ? (
        <NoteBlock
          title="Additional comments"
          text={purchaseDetails.comments}
        />
      ) : null}
    </div>
  );
}

function NoteBlock({ title, text }) {
  if (!text) return null;

  return (
    <div className="bg-gray-50 dark:bg-gray-700/40 rounded-md p-3">
      <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
        {title}
      </p>
      <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words">
        {text}
      </p>
    </div>
  );
}
