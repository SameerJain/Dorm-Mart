export default function DeleteListingModal({ onClose, onDelete }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700">
        <div className="px-6 pt-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Are you sure you want to delete?
          </h2>
          <p className="mt-2 text-gray-600 dark:text-gray-300">
            This action cannot be undone.
          </p>
        </div>
        <div className="px-6 py-4 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
