import React from "react";

/**
 * Standard in-app back control: bordered chip with "← Back" (matches settings headers).
 * Pass optional `className` for visibility breakpoints (e.g. `hidden md:inline-flex`).
 */
export default function PageBackButton({ onClick, className = "", children = "← Back", ...rest }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center justify-center rounded-lg border border-slate-300 px-3 py-1 text-sm font-medium text-blue-600 hover:bg-slate-50 dark:border-gray-600 dark:text-blue-400 dark:hover:bg-gray-700 ${className}`.trim()}
      aria-label="Go back"
      {...rest}
    >
      {children}
    </button>
  );
}
