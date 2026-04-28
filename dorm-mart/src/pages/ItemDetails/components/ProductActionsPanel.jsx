export default function ProductActionsPanel({
  normalized,
  myId,
  isSellerViewingOwnProduct,
  isInWishlist,
  wishlistLoading,
  onWishlistToggle,
  msgLoading,
  msgError,
  onMessageSeller,
  onEditListing,
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200/70 dark:border-gray-700/70 shadow-sm p-4 w-full relative">
      {!isSellerViewingOwnProduct && normalized && (
        <WishlistButton
          isInWishlist={isInWishlist}
          loading={wishlistLoading}
          disabled={wishlistLoading || !myId}
          onClick={onWishlistToggle}
        />
      )}

      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-semibold text-gray-900 dark:text-gray-100">
          ${normalized.price?.toFixed(2)}
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

      <div className="mt-3 space-y-2 flex flex-col items-center">
        {isSellerViewingOwnProduct ? (
          <>
            <div className="mb-3 p-3 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-lg w-full">
              <div className="flex items-start gap-2">
                <svg
                  className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                <div>
                  <p className="text-lg font-semibold text-yellow-900 dark:text-yellow-100 mb-1">
                    Buyer's Perspective View
                  </p>
                  <p className="text-base text-yellow-700 dark:text-yellow-300">
                    You're viewing your listing from a buyer's perspective. This helps you see how your item appears to potential buyers.
                  </p>
                </div>
              </div>
            </div>
            <button
              onClick={onEditListing}
              className="w-full max-w-xs rounded-full font-medium py-2 bg-blue-800 dark:bg-blue-900 hover:bg-blue-900 dark:hover:bg-blue-800 text-white"
            >
              Edit Listing
            </button>
          </>
        ) : (
          <>
            <button
              onClick={onMessageSeller}
              disabled={!normalized.sellerId || msgLoading}
              className="w-full max-w-xs rounded-full font-medium py-2 px-3 bg-blue-600 dark:bg-blue-800 hover:bg-blue-700 dark:hover:bg-blue-900 disabled:opacity-50 text-white"
            >
              {msgLoading ? "Opening chat..." : "Message Seller"}
            </button>
            {msgError ? <p className="text-xs text-red-600 dark:text-red-400">{msgError}</p> : null}
          </>
        )}
      </div>
    </div>
  );
}

function WishlistButton({ isInWishlist, loading, disabled, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`absolute top-3 right-3 rounded-full font-medium px-3 py-1.5 flex items-center gap-1.5 text-sm whitespace-nowrap ${
        isInWishlist
          ? "bg-purple-600 dark:bg-purple-700 hover:bg-purple-700 dark:hover:bg-purple-600 text-white"
          : "bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200"
      } disabled:opacity-50 transition-colors`}
      title={loading ? "Loading..." : isInWishlist ? "Saved to Wishlist" : "Add to Wishlist"}
    >
      <svg
        className={`w-4 h-4 ${isInWishlist ? "fill-current" : ""}`}
        fill={isInWishlist ? "currentColor" : "none"}
        stroke="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
        />
      </svg>
      {loading ? (
        <span className="hidden sm:inline">Loading...</span>
      ) : isInWishlist ? (
        <span className="hidden sm:inline">Saved to Wishlist</span>
      ) : (
        <span className="hidden sm:inline">Add to Wishlist</span>
      )}
    </button>
  );
}
