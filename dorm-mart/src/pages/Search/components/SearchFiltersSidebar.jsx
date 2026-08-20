import { useEffect, useState } from "react";
import { decimalNumericKeyDownHandler } from "../../../utils/numericInputKeyHandlers";
import {
  buildSearchUrl,
  PRICE_FILTER_PATTERN,
  readSearchFilters,
  validateSearchPrices,
} from "../utils/searchResultsUtils";

export default function SearchFiltersSidebar({
  categories,
  query,
  includeDescription,
  onToggleIncludeDescription,
  navigate,
  onApplied,
}) {
  const [filters, setFilters] = useState(() => readSearchFilters(query));
  const [priceError, setPriceError] = useState("");
  const {
    selectedCategories,
    sortOrder,
    minPrice,
    maxPrice,
    itemLocation,
    itemCondition,
    priceNegotiable,
    acceptingTrades,
  } = filters;

  useEffect(() => {
    setFilters(readSearchFilters(query));
    setPriceError("");
  }, [query]);

  function toggleCategory(category) {
    setFilters((current) => ({
      ...current,
      selectedCategories: current.selectedCategories.includes(category)
        ? current.selectedCategories.filter((value) => value !== category)
        : [...current.selectedCategories, category],
    }));
  }

  function updateFilter(name, value) {
    setFilters((current) => ({ ...current, [name]: value }));
  }

  function applyFilters() {
    const prices = validateSearchPrices(minPrice, maxPrice);
    setPriceError(prices.error);
    if (prices.error) return;

    navigate(
      buildSearchUrl({
        query,
        filters: {
          ...filters,
          minPrice: prices.minPrice,
          maxPrice: prices.maxPrice,
        },
        includeDescription,
      }),
    );
    onApplied?.();
  }

  function updatePrice(name, value) {
    if (value === "" || PRICE_FILTER_PATTERN.test(value)) {
      updateFilter(name, value);
      if (priceError) setPriceError("");
    }
  }

  return (
    <aside className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 md:sticky md:top-20">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
          Search Filters
        </h2>
        <label className="inline-flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            checked={includeDescription}
            onChange={onToggleIncludeDescription}
          />
          <span>Include description</span>
        </label>
      </div>

      <div className="mb-4">
        <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
          Categories
        </p>
        <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto pr-1">
          {categories.length ? (
            categories.map((category) => (
              <label
                key={category}
                className={`text-xs inline-flex items-center gap-1 px-2 py-1 rounded-full border cursor-pointer ${
                  selectedCategories.includes(category)
                    ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700"
                    : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600"
                }`}
              >
                <input
                  type="checkbox"
                  className="hidden"
                  checked={selectedCategories.includes(category)}
                  onChange={() => toggleCategory(category)}
                />
                <span>{category}</span>
              </label>
            ))
          ) : (
            <span className="text-xs text-gray-400 dark:text-gray-500">
              Loading…
            </span>
          )}
        </div>
      </div>

      <div className="mb-4">
        <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
          Sort
        </p>
        <div className="flex flex-col gap-2 text-sm text-gray-700 dark:text-gray-300">
          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              name="sort"
              checked={sortOrder === "new"}
              onChange={() => updateFilter("sortOrder", "new")}
            />
            <span>Newest → Oldest</span>
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              name="sort"
              checked={sortOrder === "old"}
              onChange={() => updateFilter("sortOrder", "old")}
            />
            <span>Oldest → Newest</span>
          </label>
        </div>
      </div>

      <div className="mb-4">
        <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
          Price Range ($0 – $9999.99)
        </p>
        <div className="mt-2 flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
          <div className="flex items-center gap-2">
            <span>Min</span>
            <input
              type="text"
              inputMode="decimal"
              maxLength={7}
              pattern="[0-9.]*"
              value={minPrice || ""}
              onKeyDown={decimalNumericKeyDownHandler}
              onChange={(event) =>
                updatePrice("minPrice", event.target.value)
              }
              placeholder="Min"
              className="w-20 px-2 py-1 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
            />
          </div>
          <div className="flex items-center gap-2">
            <span>Max</span>
            <input
              type="text"
              inputMode="decimal"
              maxLength={7}
              pattern="[0-9.]*"
              value={maxPrice || ""}
              onKeyDown={decimalNumericKeyDownHandler}
              onChange={(event) =>
                updatePrice("maxPrice", event.target.value)
              }
              placeholder="Max"
              className="w-20 px-2 py-1 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
            />
          </div>
        </div>
        {priceError ? (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">
            {priceError}
          </p>
        ) : null}
      </div>

      <div className="mb-4">
        <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
          Item Location
        </p>
        <select
          value={itemLocation}
          onChange={(event) =>
            updateFilter("itemLocation", event.target.value)
          }
          className="w-full px-2 py-1.5 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
        >
          <option value="">Any</option>
          <option value="North Campus">North Campus</option>
          <option value="South Campus">South Campus</option>
          <option value="Ellicott">Ellicott</option>
          <option value="Other">Other</option>
        </select>
      </div>

      <div className="mb-4">
        <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
          Item Condition
        </p>
        <select
          value={itemCondition}
          onChange={(event) =>
            updateFilter("itemCondition", event.target.value)
          }
          className="w-full px-2 py-1.5 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
        >
          <option value="">Any</option>
          <option value="Like New">Like New</option>
          <option value="Excellent">Excellent</option>
          <option value="Good">Good</option>
          <option value="Fair">Fair</option>
          <option value="For Parts">For Parts</option>
        </select>
      </div>

      <div className="mb-4">
        <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
          Options
        </p>
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 mb-2">
          <input
            type="checkbox"
            checked={priceNegotiable}
            onChange={(event) =>
              updateFilter("priceNegotiable", event.target.checked)
            }
          />
          <span>Price Negotiable</span>
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            checked={acceptingTrades}
            onChange={(event) =>
              updateFilter("acceptingTrades", event.target.checked)
            }
          />
          <span>Accepting Trades</span>
        </label>
      </div>

      <button
        onClick={applyFilters}
        className="w-full px-3 py-2 rounded text-sm font-medium transition-colors bg-blue-600 dark:bg-blue-800 text-white hover:bg-blue-700 dark:hover:bg-blue-900"
      >
        Apply
      </button>
    </aside>
  );
}
