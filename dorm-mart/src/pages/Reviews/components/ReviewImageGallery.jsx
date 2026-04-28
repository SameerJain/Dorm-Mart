import { useState } from "react";
import { API_BASE } from "../../../utils/apiConfig";
import { resolveProductPhotoUrl } from "../../../utils/imageFallback";

const reviewImageUrl = (url) =>
  resolveProductPhotoUrl(url, { apiBase: API_BASE, proxyUnknown: true });

const sellerImageFrameClass =
  "relative group w-full h-96 max-h-96 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/40 flex items-center justify-center overflow-hidden";

const thumbnailFrameClass =
  "h-24 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/40 flex items-center justify-center overflow-hidden";

function getReviewImages(review) {
  return [review?.image1_url, review?.image2_url, review?.image3_url].filter(
    Boolean,
  );
}

export default function ReviewImageGallery({ review, viewMode }) {
  const images = getReviewImages(review);
  const [selectedImage, setSelectedImage] = useState(null);

  if (images.length === 0) return null;

  const handleDownloadImage = async (imageUrl, filename) => {
    try {
      const response = await fetch(reviewImageUrl(imageUrl), {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch image");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading image:", error);
      alert("Failed to download image. Please try again.");
    }
  };

  return (
    <div className="mb-6">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        Images
      </label>

      {viewMode === "seller" ? (
        <div className="space-y-4">
          {images.map((imageUrl, index) => (
            <div key={imageUrl} className={sellerImageFrameClass}>
              <img
                src={reviewImageUrl(imageUrl)}
                alt={`Review attachment ${index + 1}`}
                onClick={() => setSelectedImage(imageUrl)}
                className="max-h-full max-w-full object-contain cursor-pointer hover:opacity-90 transition-opacity"
              />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownloadImage(
                    imageUrl,
                    `review-image-${index + 1}.jpg`,
                  );
                }}
                className="absolute top-2 right-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity"
              >
                Download
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {images.map((imageUrl, index) => (
            <div key={imageUrl} className={thumbnailFrameClass}>
              <img
                src={reviewImageUrl(imageUrl)}
                alt={`Review attachment ${index + 1}`}
                className="max-h-full max-w-full object-contain cursor-pointer hover:opacity-90"
              />
            </div>
          ))}
        </div>
      )}

      {viewMode === "seller" && selectedImage && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-75 p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative flex max-h-[90vh] max-w-[min(100%,90vw)] items-center justify-center">
            <img
              src={reviewImageUrl(selectedImage)}
              alt="Selected review attachment"
              className="max-h-[85vh] max-w-full w-auto h-auto object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              type="button"
              onClick={() => setSelectedImage(null)}
              className="absolute top-4 right-4 bg-white hover:bg-gray-100 text-gray-900 rounded-full p-2 shadow-lg"
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
        </div>
      )}
    </div>
  );
}
