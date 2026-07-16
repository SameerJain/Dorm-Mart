export default function SellerDashboardFilters({
  categories,
  selectedCategory,
  selectedSort,
  selectedStatus,
  onCategoryChange,
  onSortChange,
  onStatusChange,
}) {
  return (
    <div className="bg-gray-50 dark:bg-gray-800 border-b dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-4 flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
          <div className="flex items-center w-full sm:w-auto">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
              Status
            </label>
            <div className="relative ml-1 flex-1 sm:flex-none">
              <select
                value={selectedStatus}
                onChange={(e) => onStatusChange(e.target.value)}
                className="w-full bg-white border-2 border-gray-300 rounded-lg px-3 py-2 pr-10 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none cursor-pointer"
              >
                <option value="All Status">All Status</option>
                <option value="Active">Active</option>
                <option value="Draft">Draft</option>
                <option value="Sold">Sold</option>
                <option value="Removed">Removed</option>
              </select>
              <SelectChevron />
            </div>
          </div>

          <div className="flex items-center w-full sm:w-auto">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
              Category
            </label>
            <div className="relative ml-1 flex-1 sm:flex-none">
              <select
                value={selectedCategory}
                onChange={(e) => onCategoryChange(e.target.value)}
                className="w-full bg-white border-2 border-gray-300 rounded-lg px-3 py-2 pr-10 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none cursor-pointer"
              >
                <option>All Categories</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              <SelectChevron />
            </div>
          </div>

          <div className="flex items-center w-full sm:w-auto">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
              Sort By
            </label>
            <div className="relative ml-1 flex-1 sm:flex-none">
              <select
                value={selectedSort}
                onChange={(e) => onSortChange(e.target.value)}
                className="w-full bg-white border-2 border-gray-300 rounded-lg px-3 py-2 pr-10 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none cursor-pointer"
              >
                <option value="Newest First">Newest First (Date Only)</option>
                <option value="Oldest First">Oldest First (Date Only)</option>
                <option value="Price: Low to High">Price: Low to High</option>
                <option value="Price: High to Low">Price: High to Low</option>
                {selectedStatus === "Sold" && (
                  <>
                    <option value="Reviewed Items On Top">
                      Reviewed Items On Top
                    </option>
                    <option value="Reviewed Items On Bottom">
                      Reviewed Items On Bottom
                    </option>
                  </>
                )}
              </select>
              <SelectChevron />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SelectChevron() {
  return (
    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  );
}
