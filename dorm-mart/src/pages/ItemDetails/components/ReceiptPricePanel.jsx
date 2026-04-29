export default function ReceiptPricePanel({
  normalized,
  displayPriceText,
  msgLoading,
  msgError,
  isSellerViewingOwnProduct,
  onMessageSeller,
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200/70 dark:border-gray-700/70 shadow-sm p-4 w-full max-w-md">
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-semibold text-gray-900 dark:text-gray-100">
          {displayPriceText}
        </span>
        {normalized.priceNego ? (
          <span className="text-xs text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-full px-2 py-0.5">
            Price Negotiable
          </span>
        ) : null}
        {normalized.trades ? (
          <span className="text-xs text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-full px-2 py-0.5">
            Open to trades
          </span>
        ) : null}
      </div>
      <p className="text-sm text-emerald-700 dark:text-emerald-400 mt-1">
        {normalized.sold ? "Not available" : "In Stock"}
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Pickup: {normalized.itemLocation || "On campus"}
      </p>

      <div className="mt-3 space-y-2">
        <button
          onClick={onMessageSeller}
          disabled={
            !normalized.sellerId || msgLoading || isSellerViewingOwnProduct
          }
          className={`w-full rounded-full font-medium py-2 px-3 ${
            isSellerViewingOwnProduct
              ? "bg-gray-400 dark:bg-gray-600 cursor-not-allowed text-white"
              : "bg-blue-600 dark:bg-blue-800 hover:bg-blue-700 dark:hover:bg-blue-900 disabled:opacity-50 text-white"
          }`}
        >
          {msgLoading ? "Opening chat..." : "Message Seller"}
        </button>
        {msgError ? (
          <p className="text-xs text-red-600 dark:text-red-400">{msgError}</p>
        ) : null}
      </div>
    </div>
  );
}
