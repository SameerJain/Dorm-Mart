import { useLayoutEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import ItemDetailHeader from "./components/ItemDetailHeader";
import ItemFactsPanel from "./components/ItemFactsPanel";
import ProductActionsPanel from "./components/ProductActionsPanel";
import ProductImageGallery from "./components/ProductImageGallery";
import SellerMetaRow from "./components/SellerMetaRow";
import useCurrentUserId from "./hooks/useCurrentUserId";
import useItemProductId from "./hooks/useItemProductId";
import useMessageSeller from "./hooks/useMessageSeller";
import useProductDetail from "./hooks/useProductDetail";
import useWishlistStatus from "./hooks/useWishlistStatus";

export default function ViewProduct() {
  const navigate = useNavigate();
  const location = useLocation();
  const productId = useItemProductId();
  const returnTo = location.state?.returnTo;
  const myId = useCurrentUserId();
  const { loading, error, normalized } = useProductDetail(productId);

  useLayoutEffect(() => {
    if (!productId) return;

    window.scrollTo(0, 0);
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement) {
      activeElement.blur();
    }
  }, [productId]);

  const isSellerViewingOwnProduct =
    myId &&
    normalized?.sellerId &&
    Number(myId) === Number(normalized.sellerId);

  const { isInWishlist, wishlistLoading, wishlistError, handleWishlistToggle } =
    useWishlistStatus({
      productId,
      myId,
      disabled: isSellerViewingOwnProduct,
    });

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

  const handleEditListing = () => {
    navigate(`/app/product-listing/edit/${normalized.productId}`, {
      state: { returnTo: `/app/viewProduct/${normalized.productId}` },
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <ItemDetailHeader
        title="Product Details"
        onBack={handleBack}
        onDashboard={() => navigate("/app/seller-dashboard")}
        showDashboardLink={
          isSellerViewingOwnProduct && !location.state?.fromDashboard
        }
        compactDashboardLabel
      />

      {wishlistError && normalized && (
        <div className="w-full px-2 md:px-4 py-1">
          <p className="text-xs text-red-600 dark:text-red-400">
            {wishlistError}
          </p>
        </div>
      )}

      <div className="w-full px-2 md:px-4 py-4">
        {loading ? (
          <p className="text-center text-sm text-gray-400 dark:text-gray-500">
            Loading product...
          </p>
        ) : error ? (
          <p className="text-center text-sm text-red-500 dark:text-red-400">
            Couldn't load product.
          </p>
        ) : !normalized ? (
          <p className="text-center text-sm text-gray-400 dark:text-gray-500">
            No product found.
          </p>
        ) : (
          <>
            {isSellerViewingOwnProduct && (
              <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <p className="text-base font-semibold text-yellow-800 dark:text-yellow-200 text-center">
                  You are the seller of this item.
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-[1.05fr,1.15fr] gap-3 lg:gap-4 items-start">
              <ProductImageGallery
                photoUrls={normalized.photoUrls}
                title={normalized.title}
              />

              <section className="flex flex-col gap-4 min-w-0">
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 leading-snug break-words overflow-hidden">
                  {normalized.title}
                </h2>

                <SellerMetaRow normalized={normalized} />

                <ProductActionsPanel
                  normalized={normalized}
                  myId={myId}
                  isSellerViewingOwnProduct={isSellerViewingOwnProduct}
                  isInWishlist={isInWishlist}
                  wishlistLoading={wishlistLoading}
                  onWishlistToggle={handleWishlistToggle}
                  msgLoading={msgLoading}
                  msgError={msgError}
                  onMessageSeller={handleMessageSeller}
                  onEditListing={handleEditListing}
                />

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

                <ItemFactsPanel normalized={normalized} />
              </section>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
