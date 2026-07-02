import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";
import BucketSection from "./components/BucketSection";
import CancelPurchaseModal from "./components/CancelPurchaseModal";
import { useScheduledPurchases } from "./hooks/useScheduledPurchases";
import { groupScheduledPurchasesByItem } from "./utils/scheduledPurchaseUtils";

function OngoingPurchasesPage() {
  const navigate = useNavigate();
  const {
    buyerRequests,
    sellerRequests,
    loading,
    error,
    actionMessage,
    actionError,
    busyRequestId,
    respondToRequest,
    cancelRequest,
  } = useScheduledPurchases();
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [pendingCancelRequestId, setPendingCancelRequestId] = useState(0);

  useBodyScrollLock(cancelConfirmOpen);

  const groupedByItem = useMemo(
    () =>
      groupScheduledPurchasesByItem(
        buyerRequests,
        sellerRequests,
        Date.now(),
      ),
    [buyerRequests, sellerRequests],
  );

  const closeCancelModal = () => {
    setCancelConfirmOpen(false);
    setPendingCancelRequestId(0);
  };

  const purchaseCardProps = {
    actionError,
    busyRequestId,
    onAction: respondToRequest,
    onCancel: (requestId) => {
      setPendingCancelRequestId(requestId);
      setCancelConfirmOpen(true);
    },
    onOpenPurchaseHistory: (productId) => {
      navigate(`/app/purchase-history?review=${encodeURIComponent(productId)}`);
    },
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Ongoing Purchases
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-300">
            Review scheduled meetup requests.
          </p>
        </div>

        {actionMessage && (
          <div className="mb-4 text-sm text-green-600 dark:text-green-400">
            {actionMessage}
          </div>
        )}
        {actionError && (
          <div className="mb-4 text-sm text-red-600 dark:text-red-400">
            {actionError}
          </div>
        )}

        {loading ? (
          <div className="text-gray-600 dark:text-gray-300">
            Loading scheduled purchases...
          </div>
        ) : groupedByItem.length === 0 ? (
          <div className="text-gray-600 dark:text-gray-400">
            You have no scheduled purchases yet.
          </div>
        ) : (
          <div className="space-y-10">
            <BucketSection
              title="Happening now"
              bucketKey="active"
              groupedByItem={groupedByItem}
              purchaseCardProps={purchaseCardProps}
            />
            <BucketSection
              title="Needs response"
              bucketKey="needsResponse"
              groupedByItem={groupedByItem}
              purchaseCardProps={purchaseCardProps}
            />
            <BucketSection
              title="Upcoming"
              bucketKey="upcoming"
              groupedByItem={groupedByItem}
              purchaseCardProps={purchaseCardProps}
            />
            <BucketSection
              title="Past"
              bucketKey="past"
              groupedByItem={groupedByItem}
              purchaseCardProps={purchaseCardProps}
            />
          </div>
        )}

        {error && (
          <div className="mt-6 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        {cancelConfirmOpen && (
          <CancelPurchaseModal
            actionError={actionError}
            busyRequestId={busyRequestId}
            pendingCancelRequestId={pendingCancelRequestId}
            onClose={closeCancelModal}
            onConfirm={async () => {
              if (!pendingCancelRequestId) return;
              if (await cancelRequest(pendingCancelRequestId)) {
                closeCancelModal();
              }
            }}
          />
        )}
      </div>
    </div>
  );
}

export default OngoingPurchasesPage;
