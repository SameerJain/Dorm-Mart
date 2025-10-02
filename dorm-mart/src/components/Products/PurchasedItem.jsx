import { Link } from "react-router-dom";
import puppy from '../../assets/icons/puppy.jpg'


function PurchasedItem({ id, title, seller, date}) {
    return <>
      <li className="flex items-stretch justify-between p-4 border rounded-lg bg-gray-200 shadow">
        {/* Left: image */}
        <img
          src={puppy}
          alt="Item"
          className="h-40 w-40 object-cover rounded"
        />

        {/* Middle: details */}
        <div className="flex flex-col flex-1 ml-4 justify-between">
          {/* Top: title + seller */}
          <div>
            <h3 className="text-lg font-semibold">{title}</h3>
            <p className="text-sm text-gray-600">Sold by {seller}</p>
          </div>

          {/* Bottom: date */}
          <p className="text-sm text-gray-500">Purchased on {date}</p>
        </div>

        {/* Right: button */}
      <Link
        to={`item-detail/${id}`}
        state={{ id: id, title: title, seller: seller, date: date }}
        className="self-center ml-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
      >
        View Details
      </Link>
      </li>
    </>
}

export default PurchasedItem;