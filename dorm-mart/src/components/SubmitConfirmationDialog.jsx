export default function SubmitConfirmationDialog({
  isOpen,
  message,
  onCancel,
  onConfirm,
}) {
  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (!onConfirm) return onCancel();
    try {
      await onConfirm();
    } catch (_) {
      onCancel();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      onClick={(event) => event.target === event.currentTarget && onCancel()}
    >
      <div
        className="w-full max-w-md bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="px-6 pt-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Ready to Submit?
          </h2>
          <p className="mt-2 text-gray-600 dark:text-gray-300">{message}</p>
        </div>
        <div className="px-6 py-4 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 dark:bg-blue-800 dark:hover:bg-blue-900"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
