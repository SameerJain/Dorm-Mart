import React, { memo, useCallback, useMemo } from "react";
import { onProductImageError } from "../../../utils/imageFallback";
import { useNavigate } from "react-router-dom";

const PUBLIC_BASE = (process.env.PUBLIC_URL || "").replace(/\/$/, "");
const API_BASE = (process.env.REACT_APP_API_BASE || `${PUBLIC_BASE}/api`).replace(/\/$/, "");

const MessageCard = memo(function MessageCard({ message, isMine }) {
  const navigate = useNavigate();
  const metadata = message.metadata || {};
  const product = metadata.product || {};
  const previewText = message.content || "";
  const rawImageUrl = product.image_url;
  const productId = product.product_id;
  
  // Route image URL through proxy if it's a relative path or /images/ path - memoized
  const imageUrl = useMemo(() => {
    if (!rawImageUrl) return null;
    return (rawImageUrl.startsWith('http') || rawImageUrl.startsWith('/data/images/') || rawImageUrl.startsWith('/images/'))
      ? `${API_BASE}/media/image.php?url=${encodeURIComponent(rawImageUrl)}`
      : rawImageUrl;
  }, [rawImageUrl]);

  const handleClick = useCallback(() => {
    if (productId) {
      navigate(`/app/viewProduct/${encodeURIComponent(productId)}`);
    }
  }, [productId, navigate]);

  // listing_intro: light mode bright brand blue; dark mode blue-800 family (matches settings / global dark brand)
  return (
    <div 
      onClick={handleClick}
      className={`max-w-[85%] rounded-2xl border-2 border-blue-400 bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-lg overflow-hidden dark:border-blue-600 dark:from-blue-800 dark:to-blue-900 dark:shadow-black/30 ${productId ? 'cursor-pointer hover:shadow-xl hover:scale-[1.02] transition-all duration-200' : ''}`}
    >
      {imageUrl ? (
        <div className="w-full h-48 overflow-hidden border-b-2 border-blue-400/30 dark:border-blue-700/50">
          <img
            src={imageUrl}
            alt={product.title || "Listing image"}
            onError={onProductImageError}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
      ) : null}
      <div className="p-4 space-y-3 overflow-hidden">
        <div className="flex items-center gap-2 min-w-0">
          <svg className="h-5 w-5 flex-shrink-0 text-blue-100 dark:text-blue-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <p className="min-w-0 flex-1 break-words text-lg font-bold leading-tight text-white">
            {product.title || "Listing"}
          </p>
        </div>
        <div className="rounded-lg bg-blue-500/30 px-3 py-2 backdrop-blur-sm dark:bg-blue-950/45 dark:ring-1 dark:ring-blue-900/60">
          <p className="whitespace-pre-wrap break-words text-sm text-blue-50 dark:text-slate-100">
            {previewText}
          </p>
        </div>
      </div>
    </div>
  );
});

export default MessageCard;

