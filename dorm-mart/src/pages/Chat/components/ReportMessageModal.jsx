export default function ReportMessageModal({ isReporting, onCancel, onConfirm }) {
  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md bg-white dark:bg-gray-800 rounded-lg shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Report Message?
          </h3>
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
            Are you sure you would like to report this message? A moderator will review it.
          </p>
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onCancel}
              disabled={isReporting}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isReporting}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
            >
              {isReporting ? "Reporting..." : "Report"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
