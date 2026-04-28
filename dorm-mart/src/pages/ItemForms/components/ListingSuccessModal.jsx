export default function ListingSuccessModal({
  isEdit,
  location,
  navigate,
  setShowSuccess,
  showSuccess,
}) {
  if (!showSuccess || isEdit) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="success-title"
    >
      <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700">
        <div className="px-6 pt-6">
          <h2
            id="success-title"
            className="text-2xl font-bold text-green-700 dark:text-green-400"
          >
            Success
          </h2>
          <p className="mt-2 text-gray-700 dark:text-gray-200">
            Your product posting is now visible to prospective buyers.
          </p>
          <p className="mt-1 text-gray-900 dark:text-gray-100 font-semibold">
            Congrats!
          </p>
        </div>
        <div className="px-6 py-4 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => setShowSuccess(false)}
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/50"
          >
            Post another product
          </button>
          <button
            type="button"
            onClick={() => {
              window.scrollTo(0, 0);
              navigate("/app/seller-dashboard");
            }}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700"
          >
            {location.state?.fromDashboard === true
              ? "Go back to Dashboard"
              : "View Dashboard"}
          </button>
        </div>
      </div>
    </div>
  );
}
