/**
 * Standard in-app back control: bordered chip with arrow + "Back" (matches settings headers).
 * Pass optional `className` for visibility breakpoints (e.g. `hidden md:inline-flex`).
 */
export default function PageBackButton({
  onClick,
  className = "",
  children,
  ...rest
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 justify-center rounded-lg border border-slate-300 px-2 py-0.5 text-sm font-medium text-blue-600 hover:bg-slate-50 dark:border-gray-600 dark:text-blue-400 dark:hover:bg-gray-700 ${className}`.trim()}
      aria-label="Go back"
      {...rest}
    >
      <svg
        className="h-4 w-4 shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M20 12H4M4 12l6-6M4 12l6 6" />
      </svg>
      {children ?? "Back"}
    </button>
  );
}
