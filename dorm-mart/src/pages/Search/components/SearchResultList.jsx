import {
  onProductImageError,
  withFallbackImage,
} from "../../../utils/imageFallback";
import { formatCurrency, formatDate } from "../../../utils/formatters";

export default function SearchResultList({ items, loading, error, onSelectItem }) {
  if (loading) {
    return (
      <p className="text-center text-sm text-gray-400 dark:text-gray-500">
        Searching…
      </p>
    );
  }
  if (error) {
    return (
      <p className="text-center text-sm text-red-500 dark:text-red-400">
        Could not fetch search results.
      </p>
    );
  }
  if (items.length === 0) {
    return (
      <p className="text-center text-sm text-gray-400 dark:text-gray-500">
        No items found.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => {
        const status = String(item.status || "").toUpperCase();
        return (
          <li key={item.id}>
            <button
              onClick={() => onSelectItem(item.id)}
              className="w-full text-left bg-white dark:bg-gray-800 rounded-lg border border-gray-200/70 dark:border-gray-700/70 shadow-sm hover:border-blue-200 dark:hover:border-blue-700 transition p-3"
            >
              <div className="grid grid-cols-[4.5rem,1fr,6.5rem] md:grid-cols-[6rem,1fr,8rem] gap-3 items-center">
                <div className="h-20 w-20 md:h-24 md:w-24 rounded-md overflow-hidden bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600">
                  <img
                    src={withFallbackImage(item.img)}
                    alt={item.title}
                    onError={onProductImageError}
                    className="h-full w-full object-cover"
                  />
                </div>

                <div className="flex flex-col gap-0.5 md:gap-1 pr-2 min-w-0">
                  <p
                    className="text-sm md:text-base font-semibold text-gray-900 dark:text-gray-100 truncate"
                    title={item.title}
                  >
                    {item.title}
                  </p>
                  <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400 min-w-0 flex items-baseline flex-wrap gap-x-1">
                    {item.itemCondition ? (
                      <>
                        <span className="font-medium">Condition:</span>{" "}
                        {item.itemCondition} ·{" "}
                      </>
                    ) : null}
                    {item.itemLocation ? (
                      <>
                        <span className="font-medium">Location:</span>{" "}
                        {item.itemLocation} ·{" "}
                      </>
                    ) : null}
                    <span className="font-medium">Seller:</span>{" "}
                    <span
                      className="truncate inline-block max-w-full"
                      title={item.seller}
                    >
                      {item.seller}
                    </span>
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {item.createdAt
                      ? `Posted ${formatDate(item.createdAt)}`
                      : null}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-1">
                  <div className="text-base md:text-lg font-bold text-gray-900 dark:text-gray-100">
                    {formatCurrency(item.price) ?? "$0.00"}
                  </div>
                  {status && status !== "AVAILABLE" ? (
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                        status === "JUST POSTED"
                          ? "bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-700"
                          : status === "SOLD"
                            ? "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600"
                            : "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-700"
                      }`}
                    >
                      {status}
                    </span>
                  ) : null}
                </div>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
