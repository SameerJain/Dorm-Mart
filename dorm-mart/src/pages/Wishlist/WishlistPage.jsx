import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ItemCardNew from "../../components/ItemCardNew";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";
import RemoveWishlistItemModal from "./components/RemoveWishlistItemModal";
import WishlistCategoryButtons from "./components/WishlistCategoryButtons";
import { useWishlist } from "./hooks/useWishlist";
import {
  filterWishlistItems,
  getWishlistCategories,
  selectedCategoryAfterRemoval,
} from "./utils/wishlistUtils";

export default function WishlistPage() {
  const navigate = useNavigate();
  const { items: allItems, loading, removing, error, removeItem } = useWishlist();
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [confirmRemove, setConfirmRemove] = useState(null);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const categories = useMemo(
    () => getWishlistCategories(allItems),
    [allItems],
  );
  const items = useMemo(
    () => filterWishlistItems(allItems, selectedCategory),
    [allItems, selectedCategory],
  );

  useBodyScrollLock(showMobileFilters);

  useEffect(() => {
    document.body.style.overflow = confirmRemove ? "hidden" : "";
    document.documentElement.style.overflow = confirmRemove ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    };
  }, [confirmRemove]);

  async function confirmRemoveItem() {
    if (!confirmRemove?.id) return;
    const itemId = confirmRemove.id;
    const removed = await removeItem(itemId);
    if (removed) {
      const remainingItems = allItems.filter((item) => item.id !== itemId);
      setSelectedCategory((current) =>
        selectedCategoryAfterRemoval(remainingItems, current),
      );
    }
    setConfirmRemove(null);
  }

  function selectMobileCategory(category) {
    setSelectedCategory(category);
    setShowMobileFilters(false);
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="w-full px-1 sm:px-2 md:px-3 py-5 pb-10">
        <div className="grid grid-cols-1 lg:grid-cols-[0.22fr,1fr] gap-3 items-start">
          {allItems.length > 0 ? (
            <aside className="hidden lg:flex flex-col gap-3 sticky top-20 lg:-ml-3">
              <div className="bg-white dark:bg-gray-800 rounded-md border border-gray-200/70 dark:border-gray-700/70 shadow-sm p-4">
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  Quick filters
                </p>
                <WishlistCategoryButtons
                  categories={categories}
                  selectedCategory={selectedCategory}
                  onSelect={setSelectedCategory}
                />
              </div>
            </aside>
          ) : (
            <aside className="hidden lg:block" aria-hidden="true" />
          )}

          <div className="flex flex-col gap-6 min-w-0">
            <div className="mb-4">
              <div className="flex items-center justify-between gap-4 mb-2">
                <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100">
                  My Wishlist
                </h1>
                {allItems.length > 0 ? (
                  <button
                    onClick={() => setShowMobileFilters((shown) => !shown)}
                    className="lg:hidden flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    aria-label="Toggle filters"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                      />
                    </svg>
                    <span className="text-sm font-medium">Filters</span>
                  </button>
                ) : null}
              </div>
              <p className="text-gray-600 dark:text-gray-300">
                {selectedCategory
                  ? `Items in ${selectedCategory}`
                  : "Items you've saved for later"}
                {selectedCategory
                  ? ` (${items.length} ${items.length === 1 ? "item" : "items"})`
                  : null}
              </p>
            </div>
          </div>

          {!loading && !error && items.length === 0 ? (
            <div className="w-full flex flex-col items-center justify-center text-center py-12 mx-auto lg:col-start-1 lg:col-span-2">
              <svg
                className="mx-auto h-24 w-24 text-gray-400 dark:text-gray-500 mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                />
              </svg>
              <p className="text-gray-500 dark:text-gray-400 text-lg mb-2">
                {selectedCategory
                  ? `No items in ${selectedCategory}`
                  : "Your wishlist is empty"}
              </p>
              <p className="text-gray-400 dark:text-gray-500 text-sm mb-4">
                {selectedCategory
                  ? "Try selecting a different category or clear the filter."
                  : "Start adding items you're interested in!"}
              </p>
              <button
                onClick={() =>
                  selectedCategory
                    ? setSelectedCategory(null)
                    : navigate("/app")
                }
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {selectedCategory ? "Show All Items" : "Browse Items"}
              </button>
            </div>
          ) : null}

          {loading || error || items.length > 0 ? (
            <main className="flex flex-col gap-6 min-w-0 lg:col-start-2">
              {loading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
                  <p className="text-gray-500 dark:text-gray-400 text-lg">
                    Loading wishlist...
                  </p>
                </div>
              ) : error ? (
                <div className="text-center py-12">
                  <p className="text-red-600 dark:text-red-400 text-lg">
                    {error}
                  </p>
                  <button
                    onClick={() => window.location.reload()}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <div className="flex min-w-0 flex-wrap gap-4 sm:gap-6">
                  {items.map((item) => (
                    <ItemCardNew
                      key={item.id}
                      id={item.id}
                      title={item.title}
                      price={item.price}
                      tags={item.tags}
                      image={item.img}
                      status={item.status}
                      seller={item.seller}
                      sellerUsername={item.sellerUsername}
                      sellerEmail={item.sellerEmail}
                      isWishlisted={true}
                      showRemoveButton={true}
                      fixedWidth={true}
                      onRemoveFromWishlist={(itemId, title) =>
                        setConfirmRemove({ id: itemId, title })
                      }
                    />
                  ))}
                </div>
              )}
            </main>
          ) : null}
        </div>
      </div>

      {showMobileFilters && allItems.length > 0 ? (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40 lg:hidden"
            onClick={() => setShowMobileFilters(false)}
          />
          <div className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-white dark:bg-gray-800 rounded-t-2xl shadow-2xl border-t border-gray-200 dark:border-gray-700 max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Quick filters
              </h2>
              <button
                onClick={() => setShowMobileFilters(false)}
                className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                aria-label="Close filters"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="p-4">
              <WishlistCategoryButtons
                categories={categories}
                selectedCategory={selectedCategory}
                onSelect={selectMobileCategory}
                mobile={true}
              />
            </div>
          </div>
        </>
      ) : null}

      <RemoveWishlistItemModal
        item={confirmRemove}
        removing={removing}
        onCancel={() => setConfirmRemove(null)}
        onConfirm={confirmRemoveItem}
      />
    </div>
  );
}
