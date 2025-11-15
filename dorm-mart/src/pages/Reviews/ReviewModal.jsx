import React, { useState, useEffect } from "react";
import { StarRatingWithInput } from "./StarRating";
import StarRating from "./StarRating";

const API_BASE = process.env.REACT_APP_API_BASE || "/api";

/**
 * ReviewModal Component
 * 
 * Displays a modal for creating or viewing product reviews
 * 
 * Modes:
 * - "create": Shows form to create a new review with star rating and text input
 * - "view": Shows read-only display of existing review
 * 
 * @param {boolean} isOpen - Controls modal visibility
 * @param {function} onClose - Callback when modal is closed
 * @param {string} mode - "create" or "view"
 * @param {number} productId - ID of the product being reviewed
 * @param {string} productTitle - Title of the product (for display)
 * @param {object} existingReview - Existing review data (for view mode)
 * @param {function} onReviewSubmitted - Callback after successful review submission
 */
function ReviewModal({
  isOpen,
  onClose,
  mode = "create",
  productId,
  productTitle = "Product",
  existingReview = null,
  onReviewSubmitted = null,
}) {
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [charCount, setCharCount] = useState(0);

  const maxChars = 1000;

  // Reset form when modal opens in create mode
  useEffect(() => {
    if (isOpen && mode === "create") {
      setRating(0);
      setReviewText("");
      setCharCount(0);
      setError(null);
    }
  }, [isOpen, mode]);

  // Load existing review data in view mode
  useEffect(() => {
    if (isOpen && mode === "view" && existingReview) {
      setRating(existingReview.rating || 0);
      setReviewText(existingReview.review_text || "");
    }
  }, [isOpen, mode, existingReview]);

  const handleReviewTextChange = (e) => {
    const text = e.target.value;
    if (text.length <= maxChars) {
      setReviewText(text);
      setCharCount(text.length);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (mode !== "create") return;
    if (rating <= 0) {
      setError("Please select a rating");
      return;
    }
    if (reviewText.trim().length === 0) {
      setError("Please write a review");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/reviews/submit_review.php`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          product_id: productId,
          rating: rating,
          review_text: reviewText.trim(),
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to submit review");
      }

      // Success!
      if (onReviewSubmitted) {
        onReviewSubmitted(result);
      }
      onClose();
    } catch (err) {
      console.error("Error submitting review:", err);
      setError(err.message || "Failed to submit review. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid = rating > 0 && reviewText.trim().length > 0;

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            {mode === "create" ? "Leave a Review" : "Your Review"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            aria-label="Close"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          <div className="mb-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Product: <span className="font-medium text-gray-900 dark:text-gray-100">{productTitle}</span>
            </p>
          </div>

          {mode === "create" ? (
            <form onSubmit={handleSubmit}>
              {/* Rating Section */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Rating <span className="text-red-500">*</span>
                </label>
                <StarRatingWithInput
                  rating={rating}
                  onRatingChange={setRating}
                  readOnly={false}
                />
              </div>

              {/* Review Text Section */}
              <div className="mb-6">
                <label htmlFor="review-text" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Your Review <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="review-text"
                  value={reviewText}
                  onChange={handleReviewTextChange}
                  placeholder="Share your experience with this product..."
                  rows={6}
                  maxLength={maxChars}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  required
                />
                <div className="mt-1 flex items-center justify-between">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {charCount} / {maxChars} characters
                  </p>
                  {charCount >= maxChars && (
                    <p className="text-xs text-red-500">Maximum character limit reached</p>
                  )}
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!isFormValid || isSubmitting}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? "Submitting..." : "Complete"}
                </button>
              </div>
            </form>
          ) : (
            // View Mode
            <div>
              {/* Rating Display */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Your Rating
                </label>
                <div className="flex items-center gap-3">
                  <StarRating rating={rating} readOnly={true} size={32} />
                  <span className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                    {rating.toFixed(1)} / 5.0
                  </span>
                </div>
              </div>

              {/* Review Text Display */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Your Review
                </label>
                <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                  <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                    {reviewText}
                  </p>
                </div>
              </div>

              {existingReview?.created_at && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                  Submitted on {new Date(existingReview.created_at).toLocaleDateString()}
                </p>
              )}

              {/* Close Button */}
              <div className="flex justify-end">
                <button
                  onClick={onClose}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white rounded-lg font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ReviewModal;

