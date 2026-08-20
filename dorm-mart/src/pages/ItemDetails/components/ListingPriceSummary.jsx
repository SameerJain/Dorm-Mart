export default function ListingPriceSummary({
  normalized,
  price,
  truncatePickup = false,
}) {
  return (
    <>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-semibold text-gray-900 dark:text-gray-100">
          {price}
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
      <p
        className={`text-xs text-gray-500 dark:text-gray-400 ${
          truncatePickup ? "truncate" : ""
        }`}
      >
        Pickup: {normalized.itemLocation || "On campus"}
      </p>
    </>
  );
}
