import { useCallback, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import PageBackButton from "../../components/PageBackButton";
import SearchFiltersSidebar from "./components/SearchFiltersSidebar";
import SearchResultList from "./components/SearchResultList";
import { useActiveCategories } from "./hooks/useActiveCategories";
import { useSearchResults } from "./hooks/useSearchResults";
import {
  buildSearchPayload,
  getSearchTitle,
  readIncludeDescriptionPreference,
} from "./utils/searchResultsUtils";

export default function SearchResults() {
  const navigate = useNavigate();
  const location = useLocation();
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);
  const query = useMemo(
    () => new URLSearchParams(location.search),
    [location.search],
  );
  const includeDescription = useMemo(() => {
    try {
      return readIncludeDescriptionPreference(query, window.localStorage);
    } catch {
      return false;
    }
  }, [query]);
  const payload = useMemo(
    () => buildSearchPayload(query, includeDescription),
    [query, includeDescription],
  );
  const categories = useActiveCategories();
  const { items, loading, error } = useSearchResults(payload);

  const toggleIncludeDescription = useCallback(() => {
    const params = new URLSearchParams(location.search || "");
    if (includeDescription) {
      params.delete("desc");
      params.delete("includeDescription");
    } else {
      params.set("desc", "1");
    }

    try {
      window.localStorage.setItem(
        "dm_include_desc",
        includeDescription ? "0" : "1",
      );
    } catch {}

    navigate(`/app/listings?${params.toString()}`);
  }, [includeDescription, location.search, navigate]);

  const selectItem = useCallback(
    (itemId) =>
      navigate(`/app/viewProduct/${encodeURIComponent(itemId)}`),
    [navigate],
  );

  const sidebarProps = {
    categories,
    query,
    includeDescription,
    onToggleIncludeDescription: toggleIncludeDescription,
    navigate,
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900 relative">
      <div className="w-full border-b border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-800/80 backdrop-blur px-2 md:px-4 py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-shrink-0">
          <PageBackButton
            onClick={() => navigate(-1)}
            className="hidden md:inline-flex"
          />
          <button
            type="button"
            onClick={() => setShowFiltersPanel(true)}
            className="md:hidden text-xs px-2 py-1 rounded-full border border-blue-500 text-blue-600 bg-blue-50 hover:bg-blue-100 dark:border-blue-400 dark:text-blue-300 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 transition-colors"
          >
            Filters
          </button>
        </div>

        <h1 className="text-base md:text-lg font-semibold text-gray-900 dark:text-gray-100 break-words min-w-0 flex-1 text-center">
          {getSearchTitle(payload)}
        </h1>

        <div className="flex items-center justify-end flex-shrink-0">
          <PageBackButton onClick={() => navigate(-1)} className="md:hidden" />
          <div className="hidden md:block w-0" />
        </div>
      </div>

      <div
        className={`md:hidden absolute inset-0 z-40 pointer-events-none ${
          showFiltersPanel ? "pointer-events-auto" : ""
        }`}
      >
        <div
          className={`absolute inset-0 bg-black/40 transition-opacity ${
            showFiltersPanel ? "opacity-100" : "opacity-0"
          }`}
          onClick={() => setShowFiltersPanel(false)}
        />
        <div
          className={`absolute inset-y-0 left-0 max-w-xs w-72 transform transition-transform duration-300 ${
            showFiltersPanel ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="h-full bg-white dark:bg-gray-800 shadow-xl border-r border-gray-200 dark:border-gray-700 flex flex-col">
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700">
              <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                Search Filters
              </span>
              <button
                type="button"
                onClick={() => setShowFiltersPanel(false)}
                className="text-sm text-gray-500 hover:text-gray-800 dark:text-gray-300 dark:hover:text-white"
              >
                Close
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              <SearchFiltersSidebar
                {...sidebarProps}
                onApplied={() => setShowFiltersPanel(false)}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="w-full px-2 md:px-4 py-4">
        <div className="grid grid-cols-1 md:grid-cols-[260px,1fr] gap-4 items-start">
          <div className="hidden md:block">
            <SearchFiltersSidebar {...sidebarProps} />
          </div>
          <section>
            <SearchResultList
              items={items}
              loading={loading}
              error={error}
              onSelectItem={selectItem}
            />
          </section>
        </div>
      </div>
    </div>
  );
}
