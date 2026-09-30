import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../../utils/apiConfig";
import { apiGetJson } from "../../utils/apiClient";
import logger from "../../utils/logger";

function formatHours(hours) {
  if (hours === null || hours === undefined) return "No decisions yet";
  if (hours < 1) return "Under an hour";
  if (hours < 48) return `${Math.round(hours)} hour${Math.round(hours) === 1 ? "" : "s"}`;
  return `${Math.round(hours / 24)} days`;
}

function Stat({ label, value, detail }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
      <p className="text-sm text-gray-600">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
      {detail && <p className="mt-1 text-xs text-gray-500">{detail}</p>}
    </div>
  );
}

/**
 * Public "Safety at Dorm Mart" page: anonymous moderation numbers for anyone
 * evaluating the platform (students, parents, investors). Backed by
 * api/moderation/safety_summary.php, which returns counts only.
 */
export default function SafetySummaryPage() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const previousTitle = window.document.title;
    window.document.title = "Safety at Dorm Mart";
    const controller = new AbortController();
    apiGetJson(`${API_BASE}/moderation/safety_summary.php`, { signal: controller.signal })
      .then((result) => {
        if (!result?.success) throw new Error("Unable to load safety summary");
        setSummary(result.data);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        logger.error("safety summary failed:", err);
        setError(true);
      });
    return () => {
      controller.abort();
      window.document.title = previousTitle;
    };
  }, []);

  const messages = summary?.message_reports;
  const listings = summary?.listing_reports;
  const speed = summary?.response_time;

  return (
    <main className="min-h-dvh pre-login-bg px-4 py-6 pt-[max(1.5rem,env(safe-area-inset-top))] text-gray-800 sm:px-6 sm:py-10">
      <article className="mx-auto max-w-3xl rounded-2xl bg-white p-5 shadow-xl sm:p-8 md:p-10">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mb-6 inline-flex min-h-[44px] items-center rounded-lg px-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 focus:outline-none focus:ring-4 focus:ring-blue-300"
        >
          <span aria-hidden="true" className="mr-2">←</span>
          Back
        </button>

        <header className="border-b border-gray-200 pb-6">
          <h1 className="font-serif text-3xl font-bold text-gray-900 sm:text-4xl">
            Safety at Dorm Mart
          </h1>
          <p className="mt-4 leading-7 text-gray-700">
            Students can report a chat message or a listing at any time, and a
            student moderator reviews every report. These numbers are live
            totals. They never include who reported whom or what was said.
          </p>
        </header>

        {error && (
          <p role="alert" className="mt-6 rounded-lg bg-red-50 p-4 text-sm text-red-800">
            The safety numbers couldn't be loaded right now. Please try again later.
          </p>
        )}
        {!summary && !error && (
          <p aria-live="polite" className="mt-6 text-sm text-gray-600">Loading…</p>
        )}

        {summary && (
          <div className="mt-6 space-y-8">
            <section>
              <h2 className="text-xl font-bold text-gray-900">Response time</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Stat
                  label="Average time to a moderator decision"
                  value={formatHours(speed.avg_hours_to_decision)}
                  detail={`Across ${speed.reports_handled} report${speed.reports_handled === 1 ? "" : "s"} decided in the last ${speed.window_days} days`}
                />
                <Stat
                  label="Reports waiting for review"
                  value={messages.open + listings.open}
                />
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900">Chat message reports</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <Stat label="Reports received" value={messages.total} />
                <Stat label="Action taken" value={messages.action_taken} />
                <Stat label="No violation found" value={messages.dismissed} />
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900">Listing reports</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <Stat label="Reports received" value={listings.total} />
                <Stat label="Listings removed" value={listings.listings_removed} />
                <Stat label="No violation found" value={listings.dismissed} />
              </div>
              {listings.top_reasons.length > 0 && (
                <div className="mt-4">
                  <h3 className="font-semibold text-gray-900">Most common reasons</h3>
                  <ul className="mt-2 list-disc space-y-1 pl-6 text-gray-700">
                    {listings.top_reasons.map((item) => (
                      <li key={item.reason}>
                        {item.reason}: {item.count}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900">Account enforcement</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Stat label="Accounts currently banned" value={summary.banned_accounts} />
                <Stat
                  label="Messages flagged by the language filter"
                  value={summary.flagged_messages}
                  detail="Offensive words are hidden from readers automatically"
                />
              </div>
            </section>

            <p className="text-xs text-gray-500">
              Updated {new Date(summary.generated_at).toLocaleString()}.
            </p>
          </div>
        )}
      </article>
    </main>
  );
}
