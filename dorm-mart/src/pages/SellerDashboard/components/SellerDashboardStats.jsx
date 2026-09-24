import { formatCurrency } from "../../../utils/formatters";

function formatNextMeeting(iso) {
  const date = iso ? new Date(iso) : null;
  if (!date || Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function plural(count, word) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

export default function SellerDashboardStats({ metrics, stats, onCreateNewListing, onOpenOngoingPurchases }) {
  const summaryItems = [
    ["Total Posts", metrics.totalPosts],
    [
      "Active Listings",
      metrics.activeListings,
      stats ? `${metrics.activeListings} of ${stats.active_limit} slots` : null,
    ],
    ["Pending Sales", metrics.pendingSales],
    ["Items Sold", metrics.itemsSold],
    ["Total Views", metrics.totalViews],
    ["Total Wishlists", metrics.totalWishlists],
  ];

  const nextMeeting = formatNextMeeting(stats?.next_meeting_at);
  const insights = stats
    ? [
        {
          key: "earnings",
          label: "Earnings",
          value: formatCurrency(stats.earnings),
          detail:
            stats.sales_count > 0
              ? `${formatCurrency(stats.avg_sale)} avg across ${plural(stats.sales_count, "sale")}`
              : "No completed sales yet",
        },
        {
          key: "rating",
          label: "Seller Rating",
          value: stats.rating_avg !== null ? `${stats.rating_avg.toFixed(1)} / 5` : "N/A",
          detail:
            stats.review_count > 0 ? `From ${plural(stats.review_count, "review")}` : "No reviews yet",
          stars: stats.rating_avg,
        },
        {
          key: "meetups",
          label: "Upcoming Meetups",
          value: stats.upcoming_meetups,
          detail: nextMeeting
            ? `Next: ${nextMeeting}`
            : stats.awaiting_reply > 0
              ? `${plural(stats.awaiting_reply, "request")} awaiting a reply`
              : "Nothing scheduled",
          extra:
            nextMeeting && stats.awaiting_reply > 0
              ? `${plural(stats.awaiting_reply, "request")} awaiting a reply`
              : null,
          onClick: onOpenOngoingPurchases,
        },
        {
          key: "speed",
          label: "Avg. Time to Sell",
          value:
            stats.avg_days_to_sell === null
              ? "N/A"
              : stats.avg_days_to_sell < 1
                ? "< 1 day"
                : plural(Math.round(stats.avg_days_to_sell), "day"),
          detail:
            stats.avg_days_to_sell !== null
              ? "From listing to sale"
              : stats.sales_count > 0
                ? "Shows once sales have dates"
                : "Sell an item to see this",
        },
      ]
    : [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="bg-blue-600 rounded-lg p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h3 className="text-2xl font-bold text-white">Statistics</h3>
          <button
            type="button"
            onClick={onCreateNewListing}
            className="w-full sm:w-auto bg-white hover:bg-gray-50 dark:bg-gray-100 dark:hover:bg-white text-[#2563eb] px-8 py-3 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-3 border-2 border-blue-600 dark:border-blue-800 shadow-lg hover:shadow-xl transform hover:scale-105 hover:underline"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create New Listing
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6">
          {summaryItems.map(([label, value, detail]) => (
            <Metric key={label} label={label} value={value} detail={detail} />
          ))}
        </div>

        {insights.length > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
            {insights.map((insight) => (
              <Insight key={insight.key} {...insight} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value, detail }) {
  return (
    <div className="text-center bg-blue-700/40 rounded-lg p-4">
      <div className="text-3xl font-bold text-white">{value}</div>
      <div className="text-sm text-blue-100">{label}</div>
      {detail && <div className="mt-1 text-xs text-blue-200">{detail}</div>}
    </div>
  );
}

function Stars({ value }) {
  const filled = Math.round(Number(value) || 0);
  return (
    <span className="ml-2 inline-flex text-amber-300" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((n) => (
        <svg key={n} className={"h-4 w-4 " + (n <= filled ? "" : "opacity-30")} viewBox="0 0 20 20" fill="currentColor">
          <path d="M9.05 2.93c.3-.92 1.6-.92 1.9 0l1.07 3.3a1 1 0 0 0 .95.69h3.47c.97 0 1.37 1.24.59 1.81l-2.8 2.04a1 1 0 0 0-.37 1.12l1.07 3.3c.3.92-.75 1.69-1.54 1.12l-2.8-2.04a1 1 0 0 0-1.18 0l-2.8 2.04c-.78.57-1.83-.2-1.54-1.12l1.07-3.3a1 1 0 0 0-.36-1.12L2.97 8.73c-.78-.57-.38-1.81.59-1.81h3.47a1 1 0 0 0 .95-.69l1.07-3.3Z" />
        </svg>
      ))}
    </span>
  );
}

function Insight({ label, value, detail, extra, stars, onClick }) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2 text-sm font-medium text-blue-100">
        <span>{label}</span>
        {onClick && (
          <svg className="h-4 w-4 flex-none" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M7.3 14.7a1 1 0 0 1 0-1.4L10.58 10 7.3 6.7a1 1 0 0 1 1.4-1.4l4 4a1 1 0 0 1 0 1.4l-4 4a1 1 0 0 1-1.4 0Z" clipRule="evenodd" />
          </svg>
        )}
      </div>
      <div className="mt-1 flex flex-wrap items-center text-xl sm:text-2xl font-bold text-white">
        {value}
        {stars !== undefined && stars !== null && <Stars value={stars} />}
      </div>
      <div className="mt-1 text-xs text-blue-100">{detail}</div>
      {extra && <div className="mt-0.5 text-xs font-semibold text-amber-200">{extra}</div>}
    </>
  );
  const shell = "rounded-lg bg-white/10 p-4 text-left ring-1 ring-white/15";
  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      className={shell + " w-full transition-colors hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"}
    >
      {body}
    </button>
  ) : (
    <div className={shell}>{body}</div>
  );
}
