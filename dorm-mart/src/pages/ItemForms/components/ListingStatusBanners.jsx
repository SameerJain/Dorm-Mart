import { LIMITS } from "../utils/listingFormConfig";

export default function ListingStatusBanners({
  activeListingCount,
  atListingCap,
  isNew,
  loadError,
  loadingExisting,
  serverMsg,
}) {
  return (
    <>
      {serverMsg && (
        <div
          className={`mb-4 rounded-lg border p-3 text-sm ${
            loadError
              ? "bg-red-50 dark:bg-red-950/20 border-red-300 dark:border-red-800 text-red-700 dark:text-red-300"
              : "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300"
          }`}
        >
          {serverMsg}
        </div>
      )}

      {isNew && atListingCap && (
        <div className="mb-4 rounded-lg border-2 border-amber-500 dark:border-amber-600 bg-amber-50 dark:bg-amber-950/20 p-4">
          <div className="flex items-start gap-3">
            <svg
              className="w-6 h-6 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <h3 className="text-lg font-semibold text-amber-900 dark:text-amber-200">
                Active listing limit reached
              </h3>
              <p className="text-sm text-amber-800 dark:text-amber-300 mt-1">
                You currently have {activeListingCount} of{" "}
                {LIMITS.maxActiveListings} active listings. Please deactivate or
                remove an existing listing before creating a new one.
              </p>
            </div>
          </div>
        </div>
      )}

      {loadingExisting && (
        <div className="mb-4 rounded-lg border border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/20 p-4">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 dark:border-blue-400"></div>
            <p className="text-blue-700 dark:text-blue-300 font-medium">
              Loading existing listing data...
            </p>
          </div>
        </div>
      )}
    </>
  );
}
