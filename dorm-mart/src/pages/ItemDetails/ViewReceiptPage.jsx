import { useMemo, useState } from "react";
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
import { API_BASE } from "../../utils/apiConfig";
import { csrfPostJson } from "../../utils/apiClient";

export default function ViewReceipt() {
  const navigate = useNavigate();
  const location = useLocation();
  const productId = useItemProductId();
  const returnTo = location.state?.returnTo;
  const myId = useCurrentUserId();
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundRelist, setRefundRelist] = useState(false);
  const [refundError, setRefundError] = useState("");
  const [refunding, setRefunding] = useState(false);
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
  const canRefund = isSellerViewingOwnProduct && purchaseDetails?.completionSource === "stripe" && purchaseDetails?.paymentStatus === "succeeded";

  async function submitRefund() {
    setRefunding(true);
    setRefundError("");
    try {
      await csrfPostJson(`${API_BASE}/payments/refund.php`, {
        electronic_payment_id: Number(purchaseDetails.electronicPaymentId),
        relist: refundRelist,
      });
      window.location.reload();
    } catch (refundRequestError) {
      setRefundError(refundRequestError.message || "The refund could not be requested.");
      setRefunding(false);
    }
  }

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

                {purchaseDetails?.completionSource === "stripe" && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm dark:border-emerald-800 dark:bg-emerald-950/30">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-emerald-950 dark:text-emerald-100">Stripe payment · {purchaseDetails.paymentMode === "test" ? "Test Mode" : "Live Mode"}</p>
                        <p className="mt-1 text-emerald-800 dark:text-emerald-200">Status: {String(purchaseDetails.paymentStatus || "succeeded").replaceAll("_", " ")}</p>
                      </div>
                      {canRefund && <button type="button" onClick={() => setRefundOpen(true)} className="rounded-lg border border-emerald-700 px-3 py-2 font-semibold text-emerald-800 hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-emerald-200 dark:hover:bg-emerald-900/40">Issue Full Refund</button>}
                    </div>
                  </div>
                )}

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
      {refundOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="refund-title">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-800">
            <h2 id="refund-title" className="text-xl font-bold text-gray-900 dark:text-gray-100">Issue a Full Refund</h2>
            <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">Stripe will return the full buyer payment. Stripe’s original processing fee may not be returned and remains your responsibility.</p>
            <fieldset className="mt-5 space-y-3">
              <legend className="text-sm font-semibold text-gray-900 dark:text-gray-100">What should happen to the listing?</legend>
              <label className="flex cursor-pointer gap-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700"><input type="radio" name="refund-listing" checked={!refundRelist} onChange={() => setRefundRelist(false)} /><span className="text-sm text-gray-800 dark:text-gray-200"><strong>Keep Sold</strong><br />Preserve the current sold listing.</span></label>
              <label className="flex cursor-pointer gap-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700"><input type="radio" name="refund-listing" checked={refundRelist} onChange={() => setRefundRelist(true)} /><span className="text-sm text-gray-800 dark:text-gray-200"><strong>Return to Active</strong><br />Clear sold fields and relist the item.</span></label>
            </fieldset>
            {refundError && <p role="alert" className="mt-4 text-sm text-red-600 dark:text-red-400">{refundError}</p>}
            <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setRefundOpen(false)} disabled={refunding} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold dark:border-gray-600">Cancel</button><button type="button" onClick={submitRefund} disabled={refunding} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">{refunding ? "Requesting…" : "Refund Payment"}</button></div>
          </div>
        </div>
      )}
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
