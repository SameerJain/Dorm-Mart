import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { formatCurrency } from "../../utils/formatters";
import ItemDetailHeader from "./components/ItemDetailHeader";
import ItemFactsPanel from "./components/ItemFactsPanel";
import ProductImageGallery from "./components/ProductImageGallery";
import ReceiptDetailsPanel from "./components/ReceiptDetailsPanel";
import ReceiptPricePanel from "./components/ReceiptPricePanel";
import SellerMetaRow from "./components/SellerMetaRow";
import useCurrentUserId from "./hooks/useCurrentUserId";
import useItemProductId from "./hooks/useItemProductId";
import useMessageSeller from "./hooks/useMessageSeller";
import useReceiptDetail from "./hooks/useReceiptDetail";
import {
  buildPurchaseRows,
  normalizeReceiptDetails,
} from "./utils/receiptDetails";

export default function ViewReceipt() {
  const navigate = useNavigate();
  const location = useLocation();
  const productId = useItemProductId();
  const returnTo = location.state?.returnTo;
  const myId = useCurrentUserId();
  const { loading, error, receiptData, normalized } =
    useReceiptDetail(productId);

  const isSellerViewingOwnProduct =
    myId &&
    normalized?.sellerId &&
    Number(myId) === Number(normalized.sellerId);

  const purchaseDetails = useMemo(() => {
    return normalizeReceiptDetails(receiptData, normalized);
  }, [receiptData, normalized]);

  const purchaseRows = useMemo(
    () => buildPurchaseRows(purchaseDetails),
    [purchaseDetails],
  );

  const displayedPrice = useMemo(() => {
    if (!normalized) return null;
    if (purchaseDetails?.finalPrice != null) {
      return purchaseDetails.finalPrice;
    }
    return normalized.price ?? null;
  }, [purchaseDetails, normalized]);

  const displayPriceText =
    displayedPrice != null
      ? (formatCurrency(displayedPrice) ??
        `$${Number(displayedPrice).toFixed(2)}`)
      : "\u2014";

  const isSuccessful = !purchaseDetails?.failureReason;
  const transactionStatus = isSuccessful ? "Successful" : "Failed";

  const { msgLoading, msgError, handleMessageSeller } = useMessageSeller({
    productId,
    normalized,
    isSellerViewingOwnProduct,
    returnTo,
  });

  const handleBack = () => {
    if (returnTo) {
      navigate(returnTo);
    } else {
      navigate(-1);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <ItemDetailHeader
        title="Purchase Receipt"
        onBack={handleBack}
        onDashboard={() => navigate("/app/seller-dashboard")}
        showDashboardLink={isSellerViewingOwnProduct}
      />

      <div className="w-full px-2 md:px-4 py-4">
        {loading ? (
          <p className="text-center text-sm text-gray-400 dark:text-gray-500">
            Loading receipt...
          </p>
        ) : error ? (
          <ReceiptError error={error} />
        ) : !normalized ? (
          <p className="text-center text-sm text-gray-400 dark:text-gray-500">
            No product found.
          </p>
        ) : (
          <>
            {isSellerViewingOwnProduct && (
              <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  You are the seller of this item.
                </p>
              </div>
            )}

            {purchaseDetails && (
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${
                    isSuccessful
                      ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300"
                      : "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${isSuccessful ? "bg-green-500" : "bg-red-500"}`}
                  />
                  {transactionStatus}
                </span>
                {purchaseDetails.receiptId && (
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    Receipt #{purchaseDetails.receiptId}
                  </span>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-[1.05fr,1.15fr] gap-4 items-start">
              <ProductImageGallery
                photoUrls={normalized.photoUrls}
                title={normalized.title}
              />

              <section className="flex flex-col gap-3 min-w-0">
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 leading-snug break-words overflow-hidden">
                  {normalized.title}
                </h2>

                <SellerMetaRow normalized={normalized} />

                <ReceiptDetailsPanel
                  purchaseDetails={purchaseDetails}
                  purchaseRows={purchaseRows}
                />

                {!purchaseDetails && (
                  <ReceiptPricePanel
                    normalized={normalized}
                    displayPriceText={displayPriceText}
                    msgLoading={msgLoading}
                    msgError={msgError}
                    isSellerViewingOwnProduct={isSellerViewingOwnProduct}
                    onMessageSeller={handleMessageSeller}
                  />
                )}

                {normalized.description ? (
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">
                      About this item
                    </h3>
                    <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line break-words overflow-hidden min-w-0">
                      {normalized.description}
                    </p>
                  </div>
                ) : null}

                <ItemFactsPanel normalized={normalized} variant="receipt" />
              </section>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ReceiptError({ error }) {
  return (
    <div className="text-center">
      <p className="text-sm text-red-500 dark:text-red-400 font-medium mb-2">
        Couldn't load receipt.
      </p>
      {error.message && !error.message.startsWith("HTTP ") && (
        <p className="text-xs text-red-400 dark:text-red-500">
          {error.message}
        </p>
      )}
      {error.message && error.message.startsWith("HTTP ") && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          Error code: {error.message}
        </p>
      )}
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
        Please check your connection and try again.
      </p>
    </div>
  );
}
