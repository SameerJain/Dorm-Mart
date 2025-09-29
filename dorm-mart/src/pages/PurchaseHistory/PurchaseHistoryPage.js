import PurchasedItem from '../../components/Products/PurchasedItem'
import searchIcon from '../../assets/icons/icons8-search-96.png';
import { Outlet } from 'react-router-dom';

const items = [
    {
        id: 1,
        title: "Wireless Mouse",
        seller: "Chris Kim",
        date: "Jan 10, 2024"
    },
    {
        id: 2,
        title: "Wall Poster",
        seller: "Alice Johnson",
        date: "Jan 9, 2024"
    },
    {
        id: 3,
        title: "Desk Lamp",
        seller: "Bob Lee",
        date: "Jan 8, 2024"
    },
    {
        id: 4,
        title: "Desk Lamp",
        seller: "Bob Lee",
        date: "Jan 8, 2024"
    },
    {
        id: 5,
        title: "Desk Lamp",
        seller: "Bob Lee",
        date: "Jan 8, 2024"
    }
];

function PurchaseHistoryPage() {
    return <>
    <div className="mx-32 p-6">
      <h2 className="mb-2 text-2xl font-bold">Search Purchase History</h2>

    <div className="mb-4 relative w-[506px]">
    {/* Search icon */}
    <span className="absolute left-0 top-0 flex h-full w-16 items-center justify-center bg-blue-600 rounded-lg">
        <img src={searchIcon} alt="Search" className="h-6 w-6 invert" />
    </span>

    {/* Input with pill shape */}
    <input
        type="text"
        placeholder="Search purchases..."
        className="w-full rounded-lg pl-20 pr-3 py-3 text-base bg-gray-300 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
    </div>

      {/* List of items */}
      <ul className="space-y-4">
         {items.map((item, index) => (
            <PurchasedItem key={index} id={item.id} title={item.title} seller={item.seller} date={item.date} />
         ))}
        {/* repeat <li> for more items */}
      </ul>
    </div>
    <Outlet />
    </>
}


export default PurchaseHistoryPage