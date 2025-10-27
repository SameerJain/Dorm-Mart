import React, { useState } from 'react';

export default function ItemCardNew({ title, price, seller, rating, location, tags = [], status, image }) {
  const [imgError, setImgError] = useState(false);
  const showImage = Boolean(image) && !imgError;
  return (
    <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow w-full">
      {showImage ? (
        <img
          src={image}
          alt={title}
          className="w-full h-44 object-cover rounded-lg mb-3"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="w-full h-44 rounded-lg mb-3 bg-gray-100 dark:bg-gray-700 grid place-items-center text-gray-400 dark:text-gray-500 text-sm">
          Image coming soon
        </div>
      )}
      <div className="flex items-start justify-between gap-3 mb-1">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 leading-snug line-clamp-2">{title}</h3>
        {status && <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-md whitespace-nowrap self-start">{status}</span>}
      </div>
      <p className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">{typeof price === 'number' ? `$${price.toFixed(2)}` : price}</p>
      <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 mb-2">
        <span className="truncate">👤 {seller}</span>
        <span>⭐ {rating}</span>
      </div>
      <p className="text-xs text-red-500 dark:text-red-400 mb-3">📍 {location}</p>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {tags.map((t, i) => (
            <span key={`${t}-${i}`} className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-[10px] px-2 py-0.5 rounded-full">
              {t}
            </span>
          ))}
        </div>
      )}
      <button className="w-full bg-blue-600 dark:bg-blue-700 hover:bg-blue-700 dark:hover:bg-blue-600 text-white py-2 rounded-lg font-medium">
        View
      </button>
    </div>
  );
}
