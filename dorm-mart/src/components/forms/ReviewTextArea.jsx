/** Shared review/rating textarea with character counter. */
export default function ReviewTextArea({
  id,
  label,
  optional = false,
  value,
  onChange,
  placeholder,
  maxChars,
  charCount,
  required = false,
  rows = 6,
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
      >
        {label} {required ? <span className="text-red-500">*</span> : optional ? "(Optional)" : null}
      </label>
      <div className="overflow-hidden rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 min-w-0">
        <textarea
          id={id}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          rows={rows}
          maxLength={maxChars}
          className="w-full px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none break-words border-0 rounded-none overflow-auto"
          style={{
            scrollbarWidth: "thin",
            scrollbarColor: "rgba(156, 163, 175, 0.5) transparent",
          }}
          required={required}
        />
      </div>
      <div className="mt-1 flex items-center justify-between">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {charCount} / {maxChars} characters
        </p>
        {charCount >= maxChars && (
          <p className="text-xs text-red-500">Maximum character limit reached</p>
        )}
      </div>
    </div>
  );
}
