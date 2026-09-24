import { useEffect, useState } from "react";
import { API_BASE } from "../../../utils/apiConfig";
import { csrfPostJson } from "../../../utils/apiClient";
import {
  LISTING_REPORT_DETAILS_MAX,
  LISTING_REPORT_REASONS,
} from "../../../utils/listingReportReasons";

function FlagIcon({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 21V4" />
      <path d="M5 4h11l-1.5 4L16 12H5" fill="currentColor" fillOpacity="0.15" />
    </svg>
  );
}

/**
 * Small red flag that lets anyone report a live listing to the moderators,
 * with a preset reason and optional details.
 */
export default function ReportListingButton({ productId, title }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape" && !submitting) setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, submitting]);

  const needsDetails = reason === "other" && details.trim() === "";
  const canSubmit = reason !== "" && !needsDetails && !submitting;

  function close() {
    if (submitting) return;
    setOpen(false);
    setError("");
    if (!submitted) {
      setReason("");
      setDetails("");
    }
  }

  async function submit(event) {
    event.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");
    try {
      await csrfPostJson(`${API_BASE}/moderation/report_listing.php`, {
        product_id: productId,
        reason,
        details: details.trim(),
      });
      setSubmitted(true);
    } catch (requestError) {
      setError(requestError.message || "Couldn't send your report. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Report this listing"
        title="Report this listing"
        className="flex-shrink-0 inline-flex items-center gap-1 rounded-md px-2 py-1 coarse:py-2 coarse:text-sm text-xs font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
      >
        <FlagIcon className="h-4 w-4" />
        <span>Report</span>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="report-listing-title"
          onClick={(event) => event.target === event.currentTarget && close()}
        >
          <div className="w-full max-w-md max-h-[90dvh] overflow-y-auto bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700">
            {submitted ? (
              <div className="px-6 py-6">
                <h2 id="report-listing-title" className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  Thanks for letting us know
                </h2>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                  A moderator will review this listing. You'll get a notification once they've decided.
                </p>
                <div className="mt-5 flex justify-end">
                  <button
                    type="button"
                    onClick={close}
                    className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={submit} className="px-6 py-6">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400">
                    <FlagIcon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <h2 id="report-listing-title" className="text-xl font-bold text-gray-900 dark:text-gray-100">
                      Report listing
                    </h2>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-300 break-words">
                      Why should &ldquo;{title}&rdquo; be removed? Moderators review every report.
                    </p>
                  </div>
                </div>

                <fieldset className="mt-5 space-y-2">
                  <legend className="sr-only">Reason</legend>
                  {LISTING_REPORT_REASONS.map((option) => (
                    <label
                      key={option.value}
                      className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                        reason === option.value
                          ? "border-red-400 bg-red-50 text-gray-900 dark:border-red-700 dark:bg-red-950/40 dark:text-gray-100"
                          : "border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700/50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="report-reason"
                        value={option.value}
                        checked={reason === option.value}
                        onChange={() => setReason(option.value)}
                        className="h-4 w-4 accent-red-600"
                      />
                      {option.label}
                    </label>
                  ))}
                </fieldset>

                <label className="mt-4 block text-sm font-medium text-gray-700 dark:text-gray-200">
                  {reason === "other" ? "What's wrong with this listing?" : "Anything else moderators should know? (optional)"}
                  <textarea
                    value={details}
                    onChange={(event) => setDetails(event.target.value)}
                    maxLength={LISTING_REPORT_DETAILS_MAX}
                    rows={3}
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-normal text-gray-900 focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-200 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:focus:ring-red-900"
                  />
                </label>
                <p className="mt-1 text-right text-xs text-gray-400">
                  {details.length}/{LISTING_REPORT_DETAILS_MAX}
                </p>

                {error ? (
                  <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">
                    {error}
                  </p>
                ) : null}

                <div className="mt-4 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={close}
                    disabled={submitting}
                    className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!canSubmit}
                    className="px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submitting ? "Sending..." : "Submit report"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
