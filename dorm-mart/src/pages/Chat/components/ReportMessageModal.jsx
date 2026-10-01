import { useId, useState } from "react";
import { ConfirmDialog } from "../../../components/Dialog";

/** Reasons offered when reporting a chat message (stored as the report text). */
export const MESSAGE_REPORT_REASONS = [
  "Harassment or threats",
  "Hate speech or slurs",
  "Scam or fraud",
  "Sexual or explicit content",
  "Spam",
  "Something else",
];

/**
 * Confirm dialog used for reporting (and, with `reasons` omitted, deleting)
 * a chat message. When `reasons` is given the user picks one, and it is
 * passed to `onConfirm(reason)`.
 */
export default function ReportMessageModal({
  isReporting,
  onCancel,
  onConfirm,
  title = "Report Message?",
  body = "A moderator will review this message. The sender is not told who reported it.",
  confirmLabel = "Report",
  busyLabel = "Reporting...",
  reasons = null,
}) {
  const groupName = useId();
  const [reason, setReason] = useState(reasons ? reasons[0] : null);

  return (
    <ConfirmDialog
      title={title}
      description={<p>{body}</p>}
      busy={isReporting}
      confirmLabel={confirmLabel}
      busyLabel={busyLabel}
      onConfirm={() => onConfirm(reason)}
      onCancel={onCancel}
    >
      {reasons && (
        <fieldset className="mb-4">
          <legend className="mb-2 text-sm font-medium text-gray-800 dark:text-gray-200">
            What's wrong with it?
          </legend>
          <div className="space-y-1.5">
            {reasons.map((option) => (
              <label
                key={option}
                className="flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
              >
                <input
                  type="radio"
                  name={groupName}
                  value={option}
                  checked={reason === option}
                  onChange={() => setReason(option)}
                  disabled={isReporting}
                  className="h-4 w-4 text-red-600 focus:ring-red-500"
                />
                {option}
              </label>
            ))}
          </div>
        </fieldset>
      )}
    </ConfirmDialog>
  );
}
