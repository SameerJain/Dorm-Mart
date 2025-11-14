import { Link } from "react-router-dom";
import { withFallbackImage } from "../../utils/imageFallback";

function PurchasedItem({ id, title, seller, date, image }) {
  const productIdParam = id !== undefined && id !== null ? encodeURIComponent(id) : "";
  const detailPath = `/app/viewReceipt?id=${productIdParam}`;
  const displayImage = withFallbackImage(image);
  const detailState = { id, title, seller, date, image: displayImage };

  return (
    <>
      <li className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 w-full p-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 shadow">
        {/* Left: image */}
        <Link
          to={detailPath}
          state={detailState}
          className="block"
        >
          <img
            src={displayImage}
            alt="Item"
            className="w-full h-48 sm:w-40 sm:h-40 object-cover rounded select-none"
          />
        </Link>

        {/* Middle: details */}
        <div className="flex flex-col flex-1">
          {/* Top: title + seller */}
          <div className="mt-2 sm:mt-0">
            <h3 className="text-base sm:text-lg font-semibold line-clamp-2 text-gray-900 dark:text-gray-100">
              <Link
                to={detailPath}
                state={detailState}
                className="hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded-sm"
              >
                {title}
              </Link>
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Sold by {seller}</p>
          </div>

          {/* Bottom: date */}
          <p className="mt-2 sm:mt-1 text-sm text-gray-500 dark:text-gray-400">Purchased on {date}</p>
        </div>

        {/* Right: button */}
        <Link
          to={detailPath}
          state={detailState}
          className="mt-3 sm:mt-0 w-full sm:w-auto text-center px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white rounded active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-blue-700"
        >
          See Receipt
        </Link>
      </li>
    </>
  );
}

export default PurchasedItem;
