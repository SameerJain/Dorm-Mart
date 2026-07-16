export default function SellerDashboardStats({ metrics, onCreateNewListing }) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="bg-blue-600 rounded-lg p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div className="text-white">
          <h3 className="text-2xl font-bold">Statistics</h3>
        </div>

        <div className="flex flex-wrap md:flex-nowrap items-center justify-center gap-4 md:gap-12 md:flex-1">
          <Metric label="Active Listings" value={metrics.activeListings} />
          <Metric label="Pending Sales" value={metrics.pendingSales} />
          <Metric label="Items Sold" value={metrics.itemsSold} />
        </div>

        <button
          onClick={onCreateNewListing}
          className="w-full md:w-auto bg-white hover:bg-gray-50 dark:bg-gray-100 dark:hover:bg-white text-[#2563eb] px-8 py-4 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-3 border-2 border-blue-600 dark:border-blue-800 shadow-lg hover:shadow-xl transform hover:scale-105"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create New Listing
        </button>
      </div>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="text-center">
      <div className="text-3xl font-bold text-white">{value}</div>
      <div className="text-sm text-blue-100">{label}</div>
    </div>
  );
}
