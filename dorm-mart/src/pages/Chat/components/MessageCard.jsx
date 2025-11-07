import React from "react";

function MessageCard({ message, isMine }) {
  const metadata = message.metadata || {};
  const product = metadata.product || {};
  const previewText = message.content || "";
  const imageUrl = product.image_url;

  return (
    <div
      className={
        "max-w-[80%] rounded-2xl border shadow-sm overflow-hidden " +
        (isMine ? "border-indigo-200 bg-indigo-700 text-white" : "border-gray-200 bg-white text-gray-900")
      }
    >
      {imageUrl ? (
        <div className="w-full h-40 overflow-hidden border-b border-gray-200">
          <img
            src={imageUrl}
            alt={product.title || "Listing image"}
            className="w-full h-full object-cover"
          />
        </div>
      ) : null}
      <div className="p-4 space-y-2 text-sm">
        <p className="font-semibold">
          {product.title || "Listing"}
        </p>
        <p className="whitespace-pre-wrap break-words">
          {previewText}
        </p>
      </div>
    </div>
  );
}

export default MessageCard;

