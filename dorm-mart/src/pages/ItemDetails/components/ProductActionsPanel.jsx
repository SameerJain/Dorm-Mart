import ListingPriceSummary from "./ListingPriceSummary";
import { EyeIcon, HeartIcon } from "../../../components/Icons";

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

      <ListingPriceSummary
        normalized={normalized}
        price={`$${normalized.price?.toFixed(2)}`}
        truncatePickup
      />

      <div className="mt-3 space-y-2 flex flex-col items-center">
        {isSellerViewingOwnProduct ? (
          <>
            <div className="mb-3 p-3 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-lg w-full">
              <div className="flex items-start gap-2">
                <EyeIcon className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-lg font-semibold text-yellow-900 dark:text-yellow-100 mb-1">
                    Buyer's Perspective View
                  </p>
                  <p className="text-base text-yellow-700 dark:text-yellow-300">
                    You're viewing your listing from a buyer's perspective. This
                    helps you see how your item appears to potential buyers.
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
              Message Seller
            </button>
            {msgError ? (
              <p className="text-xs text-red-600 dark:text-red-400">
                {msgError}
              </p>
            ) : null}
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
      className={`absolute top-3 right-3 rounded-full font-medium px-3 py-1.5 coarse:px-3.5 coarse:py-2.5 flex items-center gap-1.5 text-sm whitespace-nowrap ${
        isInWishlist
          ? "bg-purple-600 dark:bg-purple-700 hover:bg-purple-700 dark:hover:bg-purple-600 text-white"
          : "bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200"
      } disabled:opacity-50 transition-colors`}
      title={
        loading
          ? "Loading..."
          : isInWishlist
            ? "Saved to Wishlist"
            : "Add to Wishlist"
      }
    >
      <HeartIcon className="w-4 h-4" filled={isInWishlist} />
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
