import PageBackButton from "../../../components/PageBackButton";

export default function ItemDetailHeader({
  title,
  onBack,
  onDashboard,
  showDashboardLink = false,
  compactDashboardLabel = false,
}) {
  return (
    <div className="w-full border-b border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-800/80 backdrop-blur px-2 md:px-4 py-3 grid grid-cols-3 items-center relative">
      <div className="flex justify-start">
        <PageBackButton onClick={onBack} />
      </div>
      <h1 className="text-base md:text-lg font-semibold text-gray-900 dark:text-gray-100 text-center">
        {title}
      </h1>
      <div className="flex items-center gap-2 justify-end">
        {showDashboardLink ? (
          <button
            onClick={onDashboard}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium whitespace-nowrap"
          >
            {compactDashboardLabel ? (
              <>
                <span className="hidden sm:inline">View Seller Dashboard</span>
                <span className="sm:hidden">Dashboard</span>
              </>
            ) : (
              "View Seller Dashboard"
            )}
          </button>
        ) : (
          <div className="w-0" />
        )}
      </div>
    </div>
  );
}
