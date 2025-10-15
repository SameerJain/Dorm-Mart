import { Link } from "react-router-dom";

function PurchasedItem({ id, title, seller, date, image}) {

    return <>
      <li className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 w-full p-4 border rounded-lg bg-gray-200 shadow">
        {/* Left: image */}
        <img
          src={image}
          alt="Item"
          className="w-full h-48 sm:w-40 sm:h-40 object-cover rounded select-none"
        />

        {/* Middle: details */}
        <div className="flex flex-col flex-1">
          {/* Top: title + seller */}
          <div className="mt-2 sm:mt-0">
            <h3 className="text-base sm:text-lg font-semibold line-clamp-2">{title}</h3>
            <p className="text-sm text-gray-600">Sold by {seller}</p>
          </div>

          {/* Bottom: date */}
          <p className="mt-2 sm:mt-1 text-sm text-gray-500">Purchased on {date}</p>
        </div>

        {/* Right: button */}
      <Link
        to={`item-detail/${id}`}
        state={{ id: id, title: title, seller: seller, date: date, image: image }}
        className="mt-3 sm:mt-0 w-full sm:w-auto text-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-blue-700"
      >
        View Details
      </Link>
      </li>
    </>
}

export default PurchasedItem;