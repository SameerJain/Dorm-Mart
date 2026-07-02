import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";
import ReviewModal from "../Reviews/ReviewModal";
import BuyerRatingModal from "./BuyerRatingModal";
import DeleteListingModal from "./components/DeleteListingModal";
import SellerDashboardFilters from "./components/SellerDashboardFilters";
import SellerDashboardStats from "./components/SellerDashboardStats";
import SellerListingRow from "./components/SellerListingRow";
import { useSellerDashboardReviews } from "./hooks/useSellerDashboardReviews";
import { useSellerListings } from "./hooks/useSellerListings";
import {
  filterListings,
  sortListings,
} from "./utils/sellerDashboardUtils";
import logger from "../../utils/logger";
import { withFallbackImage } from "../../utils/imageFallback";

function SellerDashboardPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedStatus, setSelectedStatus] = useState("All Status");
  const [selectedSort, setSelectedSort] = useState("Newest First");
  const [selectedCategory, setSelectedCategory] = useState("All Categories");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedReview, setSelectedReview] = useState(null);
  const [selectedReviewProduct, setSelectedReviewProduct] = useState(null);
  const [buyerRatingModalOpen, setBuyerRatingModalOpen] = useState(false);
  const [selectedBuyerRatingProduct, setSelectedBuyerRatingProduct] =
    useState(null);

  const { listings, loading, summaryMetrics, deleteListing } =
    useSellerListings();
  const { productReviews, buyerRatings, updateBuyerRating } =
    useSellerDashboardReviews(listings);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  useBodyScrollLock(confirmOpen);

  useEffect(() => {
    const navState =
      location.state && typeof location.state === "object"
        ? location.state
        : null;
    if (navState?.openBuyerRating && navState.productId && navState.buyerId) {
      setSelectedBuyerRatingProduct({
        id: navState.productId,
        title: navState.productTitle || "Product",
        buyerId: navState.buyerId,
      });
      setBuyerRatingModalOpen(true);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.state, location.pathname, navigate]);

  const categories = useMemo(
    () =>
      Array.from(
        new Set(
          listings.flatMap((listing) =>
            Array.isArray(listing.categories) ? listing.categories : [],
          ),
        ),
      ),
    [listings],
  );

  const sortedListings = useMemo(() => {
    const filtered = filterListings(
      listings,
      selectedStatus,
      selectedCategory,
    );
    return sortListings(filtered, selectedSort, productReviews);
  }, [listings, productReviews, selectedCategory, selectedSort, selectedStatus]);

  const handleCreateNewListing = () => {
    navigate("/app/product-listing/new", { state: { fromDashboard: true } });
  };

  const openViewProduct = (id) => {
    if (!id) return;
    navigate(`/app/viewProduct/${id}`, { state: { fromDashboard: true } });
  };

  const openDeleteConfirm = (id) => {
    const listing = listings.find((item) => item.id === id);
    if (listing && String(listing.status || "").toLowerCase() === "sold") {
      alert("Cannot delete sold items.");
      return;
    }
    setPendingDeleteId(id);
    setConfirmOpen(true);
  };

  const closeDeleteConfirm = () => {
    setConfirmOpen(false);
    setPendingDeleteId(null);
  };

  const handleDelete = async () => {
    if (!pendingDeleteId) return;
    try {
      await deleteListing(pendingDeleteId);
      closeDeleteConfirm();
    } catch (error) {
      logger.error("Delete error:", error);
      alert("Failed to delete listing.");
    }
  };

  const handleStatusChange = (newStatus) => {
    setSelectedStatus(newStatus);
    if (
      newStatus !== "Sold" &&
      (selectedSort === "Reviewed Items On Top" ||
        selectedSort === "Reviewed Items On Bottom")
    ) {
      setSelectedSort("Newest First");
    }
  };

  const handleViewReview = (listing) => {
    const review = productReviews[listing.id];
    if (!review) return;
    setSelectedReview(review);
    setSelectedReviewProduct({
      id: listing.id,
      title: listing.title,
      image: withFallbackImage(listing.image),
    });
    setReviewModalOpen(true);
  };

  const handleCloseReviewModal = () => {
    setReviewModalOpen(false);
    setSelectedReview(null);
    setSelectedReviewProduct(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <SellerDashboardFilters
        categories={categories}
        selectedCategory={selectedCategory}
        selectedSort={selectedSort}
        selectedStatus={selectedStatus}
        onCategoryChange={setSelectedCategory}
        onSortChange={setSelectedSort}
        onStatusChange={handleStatusChange}
      />

      <SellerDashboardStats
        metrics={summaryMetrics}
        onCreateNewListing={handleCreateNewListing}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <h2 className="text-2xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4 sm:mb-6">
          My Listings
        </h2>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-500 dark:text-gray-400 text-lg">
              Loading listings...
            </p>
          </div>
        ) : sortedListings.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400 text-lg">
              No products posted yet.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedListings.map((listing) => (
              <SellerListingRow
                key={listing.id}
                buyerRating={buyerRatings[listing.id]}
                listing={listing}
                productReview={productReviews[listing.id]}
                onDelete={openDeleteConfirm}
                onEdit={(id) => navigate(`/app/product-listing/edit/${id}`)}
                onOpenProduct={openViewProduct}
                onRateBuyer={(item) => {
                  setSelectedBuyerRatingProduct({
                    id: item.id,
                    title: item.title,
                    buyerId: item.buyer_user_id,
                  });
                  setBuyerRatingModalOpen(true);
                }}
                onViewReview={handleViewReview}
              />
            ))}
          </div>
        )}
      </div>

      {confirmOpen && (
        <DeleteListingModal
          onClose={closeDeleteConfirm}
          onDelete={handleDelete}
        />
      )}

      {selectedReview && selectedReviewProduct && (
        <ReviewModal
          isOpen={reviewModalOpen}
          onClose={handleCloseReviewModal}
          mode="view"
          productId={selectedReviewProduct.id}
          productTitle={selectedReviewProduct.title}
          productImageUrl={selectedReviewProduct.image}
          existingReview={selectedReview}
          viewMode="seller"
        />
      )}

      {selectedBuyerRatingProduct && (
        <BuyerRatingModal
          isOpen={buyerRatingModalOpen}
          onClose={() => {
            setBuyerRatingModalOpen(false);
            setSelectedBuyerRatingProduct(null);
          }}
          productId={selectedBuyerRatingProduct.id}
          productTitle={selectedBuyerRatingProduct.title}
          buyerId={selectedBuyerRatingProduct.buyerId}
          onRatingSubmitted={(result) => {
            updateBuyerRating(selectedBuyerRatingProduct.id, result.rating);
          }}
        />
      )}
    </div>
  );
}

export default SellerDashboardPage;
