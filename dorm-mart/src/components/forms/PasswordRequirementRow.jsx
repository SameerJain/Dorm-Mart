export default function PasswordRequirementRow({
  ok,
  text,
  className = "flex items-center gap-2 text-sm",
  dotClassName = "inline-flex h-2.5 w-2.5 rounded-full",
  okTextClassName = "text-green-700",
  missingTextClassName = "text-red-700",
}) {
  return (
    <div className={className}>
      <span
        className={dotClassName}
        style={{ backgroundColor: ok ? "#22c55e" : "#ef4444" }}
      />
      <span className={ok ? okTextClassName : missingTextClassName}>{text}</span>
    </div>
  );
}
