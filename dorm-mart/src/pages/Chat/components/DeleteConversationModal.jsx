export default function DeleteConversationModal({
  deleteError,
  isDeleting,
  onCancel,
  onConfirm,
}) {
  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onCancel}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Delete Conversation?
          </h3>
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
            Are you sure you want to delete this conversation?
          </p>
          <p className="text-sm text-red-600 dark:text-red-400 font-medium mb-4">
            Warning: All scheduled purchases associated with this conversation
            will also be deleted.
          </p>
          {deleteError && (
            <p className="text-sm text-red-600 dark:text-red-400 mb-4">
              {deleteError}
            </p>
          )}
          <div className="flex gap-3 justify-end">
            <button
              onClick={onCancel}
              disabled={isDeleting}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isDeleting}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
