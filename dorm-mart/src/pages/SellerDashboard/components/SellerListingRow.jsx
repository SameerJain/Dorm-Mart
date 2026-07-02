import { formatDate, formatCurrency } from "../../../utils/formatters";
import { onProductImageError, withFallbackImage } from "../../../utils/imageFallback";
import StarRating from "../../Reviews/StarRating";
import {
  listingStatusClass,
  truncateProductTitle,
} from "../utils/sellerDashboardUtils";

export default function SellerListingRow({
  buyerRating,
  listing,
  productReview,
  onDelete,
  onEdit,
  onOpenProduct,
  onRateBuyer,
  onViewReview,
}) {
  const status = String(listing.status || "").toLowerCase();
  const canModify =
    listing.has_accepted_scheduled_purchase !== true && status !== "sold";

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 p-4 sm:p-6 overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 min-w-0">
        <div className="flex items-center space-x-3 sm:space-x-4 min-w-0 flex-1">
          <button
            type="button"
            onClick={() => onOpenProduct(listing.id)}
            className="w-12 h-12 sm:w-16 sm:h-16 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden hover:ring-2 hover:ring-blue-300 transition"
            aria-label={`Open ${truncateProductTitle(listing.title)}`}
          >
            <img
              src={withFallbackImage(listing.image)}
              alt={truncateProductTitle(listing.title)}
              onError={onProductImageError}
              className="w-full h-full object-cover"
            />
          </button>
          <div className="min-w-0 flex-1 max-w-full overflow-hidden">
            <button
              type="button"
              onClick={() => onOpenProduct(listing.id)}
              className="text-left text-base sm:text-lg font-medium text-gray-900 dark:text-gray-100 truncate hover:underline w-full block"
            >
              {truncateProductTitle(listing.title)}
            </button>
            {listing.price > 0 && (
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300">
                {formatCurrency(listing.price)}
              </p>
            )}
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
              {listing.sold_by ? `Sold by ${listing.sold_by}` : "Posted"} -{" "}
              {formatDate(listing.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end space-y-1">
          <div className="flex items-center justify-between sm:justify-end space-x-3">
            <span
              className={`px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${listingStatusClass(listing.status)}`}
            >
              {String(listing.status)}
            </span>

            {canModify && (
              <button
                onClick={() => onEdit(listing.id)}
                className="font-medium text-sm sm:text-base text-blue-600 hover:text-blue-800"
              >
                Edit
              </button>
            )}

            {canModify && (
              <button
                onClick={() => onDelete(listing.id)}
                className="font-medium text-sm sm:text-base text-red-600 hover:text-red-800"
              >
                Delete
              </button>
            )}

            {status === "sold" && listing.buyer_user_id && (
              <button
                onClick={() => onRateBuyer(listing)}
                className={`font-medium text-sm sm:text-base ${
                  buyerRating
                    ? "text-blue-600 hover:text-blue-800"
                    : "text-green-600 hover:text-green-800"
                }`}
              >
                {buyerRating ? "Buyer Rated" : "Rate Buyer"}
              </button>
            )}

            {productReview && (
              <button
                onClick={() => onViewReview(listing)}
                className="font-medium text-sm sm:text-base text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                View Review
              </button>
            )}
          </div>
          <ListingSignals
            buyerRating={buyerRating}
            listing={listing}
            productReview={productReview}
          />
        </div>
      </div>
    </div>
  );
}

function ListingSignals({ buyerRating, listing, productReview }) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${
          (listing.wishlisted || 0) === 0 ||
          String(listing.status || "").toLowerCase() === "sold"
            ? "bg-gray-100 dark:bg-gray-800/50 text-gray-600 dark:text-gray-400"
            : "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300"
        }`}
      >
        <svg
          className="w-3.5 h-3.5 fill-current"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fillRule="evenodd"
            d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
            clipRule="evenodd"
          />
        </svg>
        <span className="hidden sm:inline text-xs sm:text-sm font-medium">
          Number of Wishlists:{" "}
        </span>
        <span className="text-xs sm:text-sm font-medium">
          {String(listing.wishlisted || 0)}
        </span>
      </div>
      {productReview?.rating && (
        <RatingPill label="Seller" rating={productReview.rating} />
      )}
      {productReview?.product_rating && (
        <RatingPill label="Product" rating={productReview.product_rating} />
      )}
      {buyerRating?.rating && <RatingPill label="Buyer" rating={buyerRating.rating} />}
    </div>
  );
}

function RatingPill({ label, rating }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
        {label}:
      </span>
      <div className="flex items-center gap-0.5">
        <StarRating rating={rating} readOnly={true} size={16} />
      </div>
      <span className="text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">
        {Number(rating).toFixed(1)}
      </span>
    </div>
  );
}
