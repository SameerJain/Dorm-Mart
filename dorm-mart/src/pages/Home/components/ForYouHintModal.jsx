export default function ForYouHintModal({
  fullyVisible,
  navigate,
  onClose,
  onNavigateToPreferences,
}) {
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      role="presentation"
    >
      <button
        type="button"
        aria-label="Close dialog"
        className={`absolute inset-0 bg-black/45 transition-opacity duration-300 ease-out motion-reduce:transition-none ${
          fullyVisible ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />
      <div
        id="for-you-unlock-hint"
        role="dialog"
        aria-modal="true"
        aria-labelledby="for-you-unlock-hint-title"
        className={`relative z-10 w-full max-w-[min(100%,18.75rem)] rounded-xl border border-slate-200 bg-white pl-3.5 pr-2.5 pt-4 pb-4 shadow-xl transition-all duration-300 ease-out motion-reduce:transition-none dark:border-gray-600 dark:bg-gray-800 dark:shadow-black/40 ${
          fullyVisible
            ? "translate-y-0 scale-100 opacity-100"
            : "translate-y-1 scale-[0.98] opacity-0"
        }`}
      >
        <button
          type="button"
          aria-label="Dismiss"
          onClick={onClose}
          className="absolute right-1.5 top-1.5 rounded-md p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-100"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <div className="min-w-0 pr-7">
          <p
            id="for-you-unlock-hint-title"
            className="text-sm font-semibold text-slate-900 dark:text-gray-100"
          >
            How to unlock For You view:
          </p>
          <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-gray-300">
            Choose up to 3 interested categories in{" "}
            <button
              type="button"
              onClick={() => {
                onNavigateToPreferences();
                navigate("/app/setting/user-preferences");
              }}
              className="font-semibold text-blue-600 underline decoration-blue-400/70 underline-offset-2 hover:no-underline dark:text-blue-400"
            >
              Settings → User Preferences
            </button>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
