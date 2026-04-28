export default function DetailRow({
  label,
  value,
  suppressContactDetection = false,
  align = "center",
  labelClassName = "",
  valueClassName = "",
}) {
  const alignClass = align === "start" ? "items-start" : "items-center";
  const labelPadding = align === "start" ? "pt-0.5" : "";
  const displayValue = value ?? "—";
  const inner = (
    <div className={`flex ${alignClass} gap-2`}>
      <span
        className={`text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500 ${labelPadding} flex-shrink-0 ${suppressContactDetection ? "no-underline" : ""} ${labelClassName}`.trim()}
      >
        {label}
      </span>
      <span
        className={`text-sm text-gray-700 dark:text-gray-300 min-w-0 flex-1 truncate ${suppressContactDetection ? "plain-contact-text no-underline" : ""} ${valueClassName}`.trim()}
      >
        {displayValue}
      </span>
    </div>
  );

  if (!suppressContactDetection) return inner;

  return (
    <div
      x-apple-data-detectors="false"
      data-detectors="false"
      className="plain-contact-text min-w-0"
    >
      {inner}
    </div>
  );
}
