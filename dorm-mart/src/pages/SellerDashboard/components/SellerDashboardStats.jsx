export default function SellerDashboardStats({ metrics, onCreateNewListing }) {
  const summaryItems = [
    ["Total Posts", metrics.totalPosts],
    ["Active Listings", metrics.activeListings],
    ["Pending Sales", metrics.pendingSales],
    ["Items Sold", metrics.itemsSold],
    ["Total Views", metrics.totalViews],
    ["Total Wishlists", metrics.totalWishlists],
  ];

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
          {summaryItems.map(([label, value]) => (
            <Metric key={label} label={label} value={value} />
          ))}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="text-center bg-blue-700/40 rounded-lg p-4">
      <div className="text-3xl font-bold text-white">{value}</div>
      <div className="text-sm text-blue-100">{label}</div>
    </div>
  );
}
