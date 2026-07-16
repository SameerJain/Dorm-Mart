import { PUBLIC_BASE } from "../../../utils/apiConfig";

export default function HomeTopBar({
  bannerText,
  interests,
  navigate,
  openExternalRoute,
}) {
  return (
    <div className="w-full border-b border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-800/80 backdrop-blur px-2 sm:px-2 md:px-3 py-3 flex flex-col gap-3 min-w-0 md:flex-row md:items-center md:justify-between md:gap-3">
      <div className="min-w-0 w-full md:flex-1 md:mr-3">
        <div className="inline-flex max-w-full items-center gap-2 bg-blue-100/60 dark:bg-blue-900/30 px-3 sm:px-4 py-1.5 rounded-full border border-blue-200 dark:border-blue-700 min-h-[36px]">
          <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500 dark:bg-blue-400 inline-block"></span>
          <p className="min-w-0 truncate text-sm font-medium text-blue-700 dark:text-blue-300 transition-all duration-500 ease-in-out">
            {bannerText}
          </p>
        </div>
      </div>

      <div className="flex min-w-0 w-full flex-wrap items-center gap-2 justify-between md:w-auto md:flex-nowrap md:justify-end">
        <button
          onClick={() => navigate("/app/listings")}
          className="lg:hidden flex shrink-0 items-center gap-2 px-3 py-1.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          aria-label="Open filters"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          <span className="text-sm font-medium">Filters</span>
        </button>

        <div className="flex min-w-0 flex-1 basis-[min(100%,14rem)] flex-wrap items-center justify-end gap-2 md:basis-auto md:flex-initial">
          {interests.length ? (
            interests.map((category) => (
              <button
                key={category}
                onClick={() =>
                  openExternalRoute(
                    `${PUBLIC_BASE}/#/app/listings?category=${encodeURIComponent(category)}`,
                  )
                }
                className="inline-flex items-center rounded-full bg-blue-50 dark:bg-blue-900/30 px-4 py-1.5 text-sm font-medium text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition"
              >
                {category}
              </button>
            ))
          ) : (
            <button
              onClick={() => navigate("/app/setting/user-preferences")}
              className="inline-flex max-w-full items-center justify-center rounded-lg bg-blue-600 dark:bg-blue-800 text-white px-3 py-2 text-center text-sm font-medium leading-tight hover:bg-blue-700 dark:hover:bg-blue-900 transition whitespace-normal sm:whitespace-nowrap sm:px-4"
            >
              Set Interested Categories
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
