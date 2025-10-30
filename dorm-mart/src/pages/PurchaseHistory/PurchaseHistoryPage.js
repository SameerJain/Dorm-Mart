import PurchasedItem from "../../components/Products/PurchasedItem";
import YearSelect from "../../components/Products/YearSelect";
import { Outlet } from "react-router-dom";
import { useEffect, useState } from "react";

async function fetchPurchasedItems(year, signal) {
  const BASE = process.env.REACT_APP_API_BASE || "/api";
  const r = await fetch(
    `${BASE}/purchase-history/fetch-transacted-items.php`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ year }),
    },
    { signal }
  );
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return await r.json();
}

function PurchaseHistoryPage() {
  const [purchasedItems, setPurchasedItems] = useState([]);
  const [isFetching, setIsFetching] = useState();
  const [error, setError] = useState();

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => currentYear - i); // [2025, 2024, ..., 2016]

  // selected year state; initialize to current year
  const [year, setYear] = useState(currentYear); // controls the <select> above

  useEffect(() => {
    setIsFetching(true);
    const controller = new AbortController();

    async function loadPurchasedItems() {
      try {
        const res = await fetchPurchasedItems(year, controller.signal);
        setError(false);
        setPurchasedItems(res.data);

        setTimeout(() => {
          setIsFetching(false);
        }, 500);
      } catch (err) {
        setIsFetching(false);
        setError(true);
        if (err.name === "AbortError") return;
        console.error(err);
      }
    }
    loadPurchasedItems();
    return () => controller.abort();
  }, [year]);

  return (
    <>
      <div className="mx-auto w-full px-3 sm:px-4 lg:px-12 py-6 max-w-[90rem] bg-gray-50 dark:bg-gray-900 min-h-screen">
        <h2 className="mb-3 text-lg sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
          Search Purchase History
        </h2>

        <YearSelect
          years={years}
          value={year}
          onChange={(y) => setYear(Number(y))}
        />

        {isFetching && (
          <p className="flex justify-center items-center text-gray-500 dark:text-gray-400 text-base sm:text-lg italic py-4">
            Loading...
          </p>
        )}

        {!error && !isFetching && purchasedItems.length === 0 && (
          <p className="flex justify-center items-center text-gray-500 dark:text-gray-400 text-base sm:text-lg italic py-4">
            No purchase history exists.
          </p>
        )}

        {error && purchasedItems.length === 0 && (
          <p className="flex justify-center items-center text-gray-500 dark:text-gray-400 text-base sm:text-lg italic py-4">
            Failed to retrieve purchase history.
          </p>
        )}

        {/* List of items */}
        <ul className="mt-6 sm:mt-8 grid gap-4 sm:gap-5 lg:gap-6 grid-cols-1 lg:grid-cols-2">
          {purchasedItems.map((item, index) => (
            <PurchasedItem
              key={index}
              id={item.item_id}
              title={item.title}
              seller={item.sold_by}
              date={item.transacted_at}
              image={item.image_url}
            />
          ))}
          {/* repeat <li> for more items */}
        </ul>
      </div>
      <Outlet />
    </>
  );
}

export default PurchaseHistoryPage;
