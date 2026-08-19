import ListingPriceSummary from "./ListingPriceSummary";

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
      <ListingPriceSummary normalized={normalized} price={displayPriceText} />

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
