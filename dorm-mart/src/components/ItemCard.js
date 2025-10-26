import React from "react";

const ItemCard = ({ item }) => {
  return (
    <div className="bg-white border rounded-lg p-4 shadow-sm w-80">
      {/* Title and Condition */}
      <h3 className="font-semibold text-gray-900 mb-1">{item.title}</h3>
      <p className="text-xs text-gray-500 mb-3">{item.condition}</p>

      {/* Price */}
      <p className="text-2xl font-bold text-gray-900 mb-3">${item.price}</p>

      {/* Seller Info */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium">{item.seller}</span>
        <span className="text-xs text-gray-500">⭐ {item.rating}</span>
        <span className="text-xs text-gray-500">{item.timePosted}</span>
      </div>

      {/* Location */}
      <p className="text-xs text-red-500 mb-3">📍 {item.location}</p>

      {/* Category Tags and Sale Badge */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex gap-2">
          <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded">
            {item.category}
          </span>
        </div>
        {item.onSale && (
          <span className="bg-green-400 text-white text-xs px-2 py-1 rounded">
            SALE
          </span>
        )}
      </div>

      {/* View Button */}
      <button className="w-full bg-slate-700 text-white py-2 rounded font-medium hover:bg-slate-800">
        View
      </button>
    </div>
  );
};

export default ItemCard;
