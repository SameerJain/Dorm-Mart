export default function RemoveWishlistItemModal({
  item,
  removing,
  onCancel,
  onConfirm,
}) {
  if (!item) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="remove-confirm-title"
    >
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-6 max-w-md w-full min-w-0 overflow-hidden">
        <h2
          id="remove-confirm-title"
          className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4"
        >
          Remove from Wishlist?
        </h2>
        <div className="mb-6 min-w-0 text-gray-700 dark:text-gray-300 leading-relaxed">
          <p className="min-w-0">Are you sure you want to remove</p>
          <p
            className="mt-1 min-w-0 max-w-full font-bold text-gray-900 dark:text-gray-100 truncate"
            title={item.title}
          >
            &ldquo;{item.title}&rdquo;
          </p>
          <p className="mt-1">from your wishlist?</p>
        </div>
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={removing}
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/50 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={removing}
            className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {removing ? "Removing..." : "Remove"}
          </button>
        </div>
      </div>
    </div>
  );
}
