// Preset reasons a listing can be reported for. Keep the keys in sync with
// LISTING_REPORT_REASONS in api/helpers/listing_reports.php.
export const LISTING_REPORT_REASONS = [
  { value: "prohibited", label: "Prohibited or illegal item" },
  { value: "scam", label: "Scam or fraud" },
  { value: "misleading", label: "Misleading description or photos" },
  { value: "offensive", label: "Offensive or inappropriate content" },
  { value: "spam", label: "Spam or duplicate listing" },
  { value: "other", label: "Something else" },
];

export const LISTING_REPORT_DETAILS_MAX = 500;

export function listingReportReasonLabel(value) {
  return (
    LISTING_REPORT_REASONS.find((reason) => reason.value === value)?.label ||
    "Something else"
  );
}
