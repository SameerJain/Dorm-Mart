export default function ListingActions({
  atListingCap,
  catFetchError,
  catLoading,
  isEdit,
  isNew,
  loadingExisting,
  location,
  navigate,
  publishListing,
  submitting,
}) {
  return (
    <div className="bg-white dark:bg-gray-950/30 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-6 mt-6">
      <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-50 mb-6">
        Publish Your Listing
      </h3>
      <div className="flex flex-col sm:flex-row gap-4">
        <button
          onClick={publishListing}
          disabled={submitting || loadingExisting || (isNew && atListingCap)}
          className="flex-1 py-4 bg-blue-600 text-white rounded-lg font-bold text-lg hover:bg-blue-700 transition-colors disabled:opacity-60"
        >
          {isNew && atListingCap
            ? "Listing Limit Reached"
            : submitting
              ? "Submitting..."
              : loadingExisting
                ? "Loading..."
                : isEdit
                  ? "Update Listing"
                  : "Publish Listing"}
        </button>

        <button
          onClick={() => {
            const returnTo =
              location.state?.returnTo || "/app/seller-dashboard";
            navigate(returnTo);
          }}
          className="flex-1 py-3 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
          type="button"
        >
          {isNew ? "Cancel" : "Discard Changes"}
        </button>
      </div>
      {(catLoading || catFetchError) && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
          {catLoading
            ? "Loading categories..."
            : `Category load error: ${catFetchError}`}
        </p>
      )}
    </div>
  );
}
