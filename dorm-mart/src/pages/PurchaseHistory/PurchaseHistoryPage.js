import PurchasedItem from '../../components/Products/PurchasedItem'
import searchIcon from '../../assets/icons/icons8-search-96.png';
import { Outlet } from 'react-router-dom';
import { useEffect, useState } from 'react';


async function fetchPurchasedItems(signal) {
  const BASE = process.env.REACT_APP_API_BASE
  const r = await fetch(`${BASE}/purchasedItems.php`, { signal });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return await r.json();
}

function PurchaseHistoryPage() {
    const [purchasedItems, setPurchasedItems] = useState([])
    const [isFetching, setIsFetching] = useState()

    useEffect(() => {
      setIsFetching(true)
      const controller = new AbortController();

      async function loadPurchasedItems() {
        try {
          const res = await fetchPurchasedItems(controller.signal);
          console.log(res);
          setPurchasedItems(res);

          setTimeout(() => {
            setIsFetching(false);
          }, 500);

        } catch (err) {
          if (err.name === "AbortError") return;
          console.error(err);
        }
      }
      loadPurchasedItems();
      return () => controller.abort();
    }, []);

    return (
    <>
      <div className="mx-32 p-6">
        <h2 className="mb-2 text-2xl font-bold hidden">Search Purchase History</h2>

        <div className="mb-4 relative w-[506px] hidden">
          {/* Search icon */}
          <span className="absolute left-0 top-0 flex h-full w-16 items-center justify-center bg-blue-600 hover:bg-blue-700 rounded-lg">
              <img src={searchIcon} alt="Search" className="h-6 w-6 invert" />
          </span>

          {/* Input with pill shape */}
          <input
              type="text"
              placeholder="Search purchases..."
              className="w-full rounded-lg pl-20 pr-3 py-3 text-base bg-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-700"
          />
        </div>

        {isFetching && (
          <p className="flex justify-center items-center text-gray-500 text-lg italic py-4">
            Loading...
          </p>
        )}

        {!isFetching && purchasedItems.length === 0 && (
          <p className="flex justify-center items-center text-gray-500 text-lg italic py-4">
            No purchase history exists.
          </p>
        )}

        {/* List of items */}
        <ul className="space-y-4">
          {purchasedItems.map((item, index) => (
              <PurchasedItem key={index} id={item.id} title={item.title} seller={item.seller} date={item.date} image={item.image} />
          ))}
          {/* repeat <li> for more items */}
        </ul>
      </div>
      <Outlet />
    </>
    )
}


export default PurchaseHistoryPage