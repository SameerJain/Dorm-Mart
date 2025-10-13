import PurchasedItem from '../../components/Products/PurchasedItem'
import { Outlet } from 'react-router-dom';
import { useEffect, useState } from 'react';


async function fetchPurchasedItems(year, signal) {
  const BASE = (process.env.REACT_APP_API_BASE || "/api");
  const r = await fetch(`${BASE}/fetch-transacted-items.php`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',                                  
      'Accept': 'application/json'    
    },
    body: JSON.stringify({ year })
    }, { signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
}

function PurchaseHistoryPage() {
    const [purchasedItems, setPurchasedItems] = useState([])
    const [isFetching, setIsFetching] = useState()
    const [error, setError] = useState()

    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 10 }, (_, i) => currentYear - i); // [2025, 2024, ..., 2016]

    // selected year state; initialize to current year
    const [year, setYear] = useState(currentYear); // controls the <select> above
     
    useEffect(() => {
      setIsFetching(true)
      const controller = new AbortController();

      async function loadPurchasedItems() {
        try {
          const res = await fetchPurchasedItems(year, controller.signal);
          setError(false)
          setPurchasedItems(res.data);

          setTimeout(() => {
            setIsFetching(false);
          }, 500);

        } catch (err) {
          setIsFetching(false)
          setError(true)
          if (err.name === "AbortError") return;
            console.error(err);
        }
      }
      loadPurchasedItems();
      return () => controller.abort();
    }, [year]);

    return (
    <>
      <div className="mx-32 p-6">
        <h2 className="mb-2 text-2xl font-bold">Search Purchase History</h2>

        {/* Year selector (replaces the old search box) */}
        <div className="mb-4 w-[506px]">
          {/* Accessible label for the select input */}
          <label
            htmlFor="yearSelect"                             // ties the label to the select by id for accessibility
            className="block mb-2 text-sm font-medium text-gray-700"
          >
            Select year
          </label>

          <select
            id="yearSelect"                                   // unique identifier for the control
            value={year}                                      // controlled value from component state (see snippet below)
            onChange={(event) => setYear(Number(event.target.value))} // update state when user picks a year
            className="w-full rounded-lg px-4 py-3 text-base bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-700"
          >
            {years.map((y) => (                              // render a list of year options
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        {isFetching && (
          <p className="flex justify-center items-center text-gray-500 text-lg italic py-4">
            Loading...
          </p>
        )}

        {!error && !isFetching && purchasedItems.length === 0 && (
          <p className="flex justify-center items-center text-gray-500 text-lg italic py-4">
            No purchase history exists.
          </p>
        )}

        {error && purchasedItems.length === 0 && (
          <p className="flex justify-center items-center text-gray-500 text-lg italic py-4">
            Failed to retrieve purchase history.
          </p>
        )}


        {/* List of items */}
        <ul className="space-y-4">
          {purchasedItems.map((item, index) => (
              <PurchasedItem key={index} id={item.id} title={item.title} seller={item.sold_by} date={item.transacted_at} image={item.image_url} />
          ))}
          {/* repeat <li> for more items */}
        </ul>
      </div>
      <Outlet />
    </>
    )
}


export default PurchaseHistoryPage;