import { PUBLIC_BASE } from "../../../utils/apiConfig";

export default function HomeFeedTabs({
  activeTab,
  navigate,
  onSelectTab,
  openExternalRoute,
  quickFilterCategories,
}) {
  return (
    <div className="w-full px-1 sm:px-2 md:px-3 pt-4">
      <div className="grid grid-cols-1 lg:grid-cols-[0.32fr,1fr] gap-3 items-stretch">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200/70 dark:border-gray-700/70 shadow-sm p-4 flex flex-col gap-3">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Quick Search
          </p>
          <div className="flex flex-wrap gap-2 max-h-[7.5rem] overflow-y-auto pr-1">
            {quickFilterCategories.map((category) => (
              <button
                key={category}
                onClick={() =>
                  openExternalRoute(
                    `${PUBLIC_BASE}/#/app/listings?category=${encodeURIComponent(category)}`,
                  )
                }
                className="px-4 py-1.5 rounded-full bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm border border-gray-100 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 transition"
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200/70 dark:border-gray-700/70 shadow-sm px-4 py-4 flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="uppercase text-xs md:text-sm text-gray-400 dark:text-gray-500 tracking-[0.35em] mb-1">
                personalized feed
              </p>
              <h2 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-gray-100">
                Picks shaped by how you shop
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Real UB students • On-campus meetups • No shipping
              </p>
            </div>
            <div className="hidden sm:flex items-start">
              <button
                onClick={() => navigate("/app/product-listing/new")}
                className="px-4 py-2 rounded-lg bg-blue-600 dark:bg-blue-800 text-white text-sm font-medium hover:bg-blue-700 dark:hover:bg-blue-900 transition whitespace-nowrap"
              >
                List an item
              </button>
            </div>
          </div>
          <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-start">
            <div className="flex w-full min-w-0 flex-col items-center gap-1.5 sm:w-auto sm:items-start">
              <div className="flex w-fit items-center gap-2 rounded-full border border-gray-200 bg-gray-50 p-1 dark:border-gray-600 dark:bg-gray-700/60">
                <button
                  type="button"
                  onClick={() => onSelectTab("forYou")}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                    activeTab === "forYou"
                      ? "bg-blue-600 text-white shadow dark:bg-blue-800"
                      : "text-gray-700 hover:text-gray-900 dark:text-gray-200 dark:hover:text-white"
                  }`}
                >
                  For You
                </button>
                <button
                  type="button"
                  onClick={() => onSelectTab("explore")}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                    activeTab === "explore"
                      ? "bg-blue-600 text-white shadow dark:bg-blue-800"
                      : "text-gray-700 dark:text-gray-200"
                  }`}
                >
                  Explore More
                </button>
              </div>
            </div>
            <p className="text-left text-sm text-gray-600 dark:text-gray-300">
              Switch views: personalized feed or a fresh randomized mix.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
