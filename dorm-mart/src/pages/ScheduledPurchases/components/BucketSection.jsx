import { API_BASE } from "../../../utils/apiConfig";
import {
  onProductImageError,
  resolveProductPhotoUrl,
  withFallbackImage,
} from "../../../utils/imageFallback";
import { Link } from "react-router-dom";
import PurchaseCard from "./PurchaseCard";
import { getRequestState } from "../utils/ongoingPurchaseViewUtils";

function ItemGroup({ itemGroup, bucketKey, purchaseCardProps }) {
  const requests = itemGroup?.buckets?.[bucketKey];
  if (!requests?.length) return null;

  const photos = Array.isArray(itemGroup.item?.photos)
    ? itemGroup.item.photos
    : [];
  const thumbUrl =
    photos.length > 0
      ? resolveProductPhotoUrl(photos[0], {
          apiBase: API_BASE,
          proxyUnknown: true,
        })
      : null;
  const completedRequest = requests.find(
    (request) =>
      getRequestState(request) === "completed" &&
      request.inventory_product_id,
  );
  const receiptPath = completedRequest
    ? `/app/viewReceipt?id=${encodeURIComponent(completedRequest.inventory_product_id)}`
    : null;
  const itemTitle = itemGroup.item.title || "Unknown Item";
  const itemHeader = (
    <>
      <img
        src={withFallbackImage(thumbUrl)}
        alt={receiptPath ? "" : itemTitle}
        onError={onProductImageError}
        className="w-8 h-8 rounded object-cover flex-shrink-0 border border-gray-200 dark:border-gray-600"
      />
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 break-words overflow-wrap-anywhere group-hover:underline">
        {itemTitle}
      </h3>
    </>
  );

  return (
    <div className="min-w-0">
      {receiptPath ? (
        <Link
          to={receiptPath}
          state={{ returnTo: "/app/seller-dashboard/ongoing-purchases" }}
          className="group flex items-center gap-3 mb-3 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          {itemHeader}
        </Link>
      ) : (
        <div className="flex items-center gap-3 mb-3">{itemHeader}</div>
      )}
      <div className="space-y-3">
        {requests.map((req) => (
          <PurchaseCard
            key={`${req.perspective}-${req.request_id}`}
            req={req}
            perspective={req.perspective}
            {...purchaseCardProps}
          />
        ))}
      </div>
    </div>
  );
}

export default function BucketSection({
  title,
  bucketKey,
  groupedByItem,
  purchaseCardProps,
}) {
  const groupsWithCards = groupedByItem.filter(
    (group) => (group.buckets?.[bucketKey]?.length ?? 0) > 0,
  );
  if (groupsWithCards.length === 0) return null;

  return (
    <section className="space-y-4" aria-labelledby={`section-${bucketKey}`}>
      <h2
        id={`section-${bucketKey}`}
        className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 pb-2"
      >
        {title}
      </h2>
      <div className="space-y-8">
        {groupsWithCards.map((group) => (
          <ItemGroup
            key={`${group.productId}-${bucketKey}`}
            itemGroup={group}
            bucketKey={bucketKey}
            purchaseCardProps={purchaseCardProps}
          />
        ))}
      </div>
    </section>
  );
}
