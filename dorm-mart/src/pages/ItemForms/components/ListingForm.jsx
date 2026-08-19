import { MEET_LOCATION_OPTIONS } from "../../../constants/meetLocations";
import { decimalNumericKeyDownHandler } from "../../../utils/numericInputKeyHandlers";
import {
  CATEGORIES_MAX,
  hasListingPhoto,
  LIMITS,
} from "../utils/listingFormConfig";
import ListingActions from "./ListingActions";
import SafetyTips from "./SafetyTips";

const errorBorder = (error) =>
  error
    ? "border-red-500 bg-red-50/70 dark:bg-red-950/20"
    : "border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900";

const inputClass = (error, extra = "") =>
  `w-full p-4 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${extra} ${errorBorder(error)}`;

function FieldError({ error, className = "" }) {
  return error ? (
    <p className={`mt-1 text-sm text-red-600 dark:text-red-400 ${className}`}>
      {error}
    </p>
  ) : null;
}

function ToggleOption({ checked, description, label, onChange }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-gray-50 p-4 dark:bg-gray-900/30">
      <div>
        <label className="text-lg font-medium text-gray-900 dark:text-gray-100">
          {label}
        </label>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {description}
        </p>
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
      />
    </div>
  );
}

export default function ListingForm({
  acceptTrades,
  atListingCap,
  catFetchError,
  catLoading,
  categories,
  clearError,
  condition,
  description,
  errors,
  fileInputRef,
  formTopRef,
  handleInputChange,
  images,
  isEdit,
  isNew,
  itemLocation,
  loadingExisting,
  listingStatus,
  location,
  navigate,
  onFileChange,
  price,
  priceNegotiable,
  publishListing,
  removeCategory,
  removeImage,
  scrollPositionRef,
  selectableOptions,
  selectedCategory,
  saveDraft,
  setAcceptTrades,
  setCategories,
  setCondition,
  setDescription,
  setErrors,
  setItemLocation,
  setPrice,
  setPriceNegotiable,
  setSelectedCategory,
  setTitle,
  showTopErrorBanner,
  submitting,
  title,
}) {
  const hasPhoto = hasListingPhoto(images);

  return (
    <div ref={formTopRef}>
      {/* Top-of-Form Error Banner */}
      {showTopErrorBanner &&
        Object.keys(errors).length > 0 &&
        (() => {
          const errorCount = Object.keys(errors).length;
          const showSpecificErrors = errorCount <= 2;

          return (
            <div className="mb-6 rounded-lg border-2 border-red-500 dark:border-red-600 bg-red-50 dark:bg-red-950/20 p-4">
              <div className="flex items-start gap-3">
                <svg
                  className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div className="flex-1">
                  {showSpecificErrors ? (
                    <>
                      <h3 className="text-lg font-semibold text-red-900 dark:text-red-200 mb-2">
                        A few things need your attention:
                      </h3>
                      <ul className="list-disc list-inside space-y-1">
                        {Object.values(errors).map((error, index) => (
                          <li
                            key={index}
                            className="text-sm text-red-800 dark:text-red-300"
                          >
                            {error}
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <p className="text-lg font-semibold text-red-900 dark:text-red-200">
                      Please fill out the missing information.
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })()}
      <div className="space-y-6">
        {/* Basic Information */}
        <div className="bg-white dark:bg-gray-950/50 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-50 mb-6">
            Basic Information
          </h2>

          <div className="space-y-6">
            {/* Title */}
            <div>
              <label className="block text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Item Title <span className="text-red-500">*</span>
              </label>
              <input
                value={title}
                onChange={(e) =>
                  handleInputChange("title", e.target.value, setTitle)
                }
                className={inputClass(errors.title)}
                placeholder="Enter a descriptive title for your item"
                maxLength={LIMITS.title}
              />
              <div className="flex justify-between items-center mt-2">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Be specific and descriptive to attract buyers.
                </p>
                <p className="text-sm text-gray-400 dark:text-gray-500">
                  {title.length}/{LIMITS.title}
                </p>
              </div>
              <FieldError error={errors.title} />
            </div>

            {/* Item Condition */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-lg font-semibold text-gray-900 mb-2 dark:text-gray-100">
                  Item Condition <span className="text-red-500">*</span>
                </label>
                <select
                  value={condition}
                  onChange={(e) => {
                    setCondition(e.target.value);
                    clearError("condition");
                  }}
                  className={inputClass(errors.condition)}
                >
                  <option value="" disabled>
                    Select An Option
                  </option>
                  <option>Like New</option>
                  <option>Excellent</option>
                  <option>Good</option>
                  <option>Fair</option>
                  <option>For Parts</option>
                </select>
                <FieldError error={errors.condition} />
              </div>
            </div>

            {/* Categories */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Categories <span className="text-red-500">*</span>
                </label>

                <div className="flex flex-col gap-2">
                  <select
                    value={selectedCategory}
                    disabled={categories.length >= CATEGORIES_MAX}
                    onChange={(e) => {
                      const selected = e.target.value;
                      setSelectedCategory("");
                      if (!selected) {
                        clearError("categories");
                        return;
                      }
                      if (categories.includes(selected)) return;
                      if (categories.length >= CATEGORIES_MAX) {
                        setErrors((current) => ({
                          ...current,
                          categories: `Select at most ${CATEGORIES_MAX} categories`,
                        }));
                        return;
                      }
                      setCategories([...categories, selected]);
                      clearError("categories");
                    }}
                    className={`w-full rounded-lg border p-4 transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500 ${
                      categories.length >= CATEGORIES_MAX
                        ? "opacity-50 cursor-not-allowed bg-gray-100 dark:bg-gray-800"
                        : errorBorder(errors.categories)
                    }`}
                  >
                    <option value="" disabled>
                      Select An Option
                    </option>
                    {catLoading && <option disabled>Loading...</option>}
                    {!catLoading && selectableOptions.length === 0 && (
                      <option disabled>
                        {catFetchError || "No categories available"}
                      </option>
                    )}
                    {selectableOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>

                  {/* Selected chips */}
                  <div className="flex flex-wrap gap-2">
                    {categories.map((c) => (
                      <span
                        key={c}
                        className="flex items-center gap-2 bg-blue-100 dark:bg-blue-950/40 text-blue-800 dark:text-blue-100 rounded-full px-3 py-1"
                      >
                        <span className="text-sm font-medium">{c}</span>
                        <button
                          type="button"
                          aria-label={`remove ${c}`}
                          onClick={() => removeCategory(c)}
                          className="text-blue-600 dark:text-blue-200 hover:text-blue-800 dark:hover:text-white"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>

                  <div className="flex justify-between items-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Select up to {CATEGORIES_MAX}.
                    </p>
                    <p className="text-sm text-gray-400 dark:text-gray-500">
                      {categories.length}/{CATEGORIES_MAX}
                    </p>
                  </div>
                </div>

                <FieldError error={errors.categories} />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                value={description}
                onChange={(e) =>
                  handleInputChange(
                    "description",
                    e.target.value,
                    setDescription,
                  )
                }
                rows={6}
                className={inputClass(errors.description, "resize-none")}
                placeholder="Describe the item — condition, usage, and history."
                maxLength={LIMITS.description}
              />
              <div className="flex justify-end items-center mt-2">
                <p className="text-sm text-gray-400 dark:text-gray-500">
                  {description.length}/{LIMITS.description}
                </p>
              </div>
              <FieldError error={errors.description} />
            </div>
          </div>
        </div>

        {/* Location & Pricing */}
        <div className="bg-white dark:bg-gray-950/50 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-50 mb-6">
            Location & Pricing
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Item Location */}
            <div>
              <label className="block text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Item Location <span className="text-red-500">*</span>
              </label>
              <select
                value={itemLocation}
                onChange={(e) => {
                  setItemLocation(e.target.value);
                  clearError("itemLocation");
                }}
                className={inputClass(errors.itemLocation)}
              >
                <option value="" disabled>
                  Select An Option
                </option>
                {MEET_LOCATION_OPTIONS.filter((opt) => opt.value !== "").map(
                  (opt) => (
                    <option key={opt.value || "unselected"} value={opt.value}>
                      {opt.label}
                    </option>
                  ),
                )}
              </select>
              <FieldError error={errors.itemLocation} />
            </div>

            {/* Price */}
            <div>
              <label className="block text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Price <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-lg">
                  $
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={price}
                  maxLength={7}
                  onKeyDown={decimalNumericKeyDownHandler}
                  onChange={(e) => {
                    const value = e.target.value;
                    // Store raw string value to preserve exact user input
                    // Only convert to number when needed (validation/submission)
                    handleInputChange("price", value, setPrice);
                  }}
                  className={`w-full rounded-lg border py-4 pl-8 pr-4 transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500 ${errorBorder(errors.price)}`}
                  placeholder="0.00"
                />
              </div>
              <FieldError error={errors.price} />
            </div>
          </div>
          {/* Pricing Options */}
          <div className="mt-6 space-y-4">
            <ToggleOption
              checked={acceptTrades}
              description="Open to trade offers for your item"
              label="Accepting Trades"
              onChange={() => setAcceptTrades((value) => !value)}
            />
            <ToggleOption
              checked={priceNegotiable}
              description="Willing to negotiate on price"
              label="Price Negotiable"
              onChange={() => setPriceNegotiable((value) => !value)}
            />
          </div>
          {/* Photos and videos */}
          <div
            className={`bg-white dark:bg-gray-950/30 rounded-2xl shadow-sm border p-6 mt-6 ${
              errors.images
                ? "border-red-500 dark:border-red-600"
                : "border-gray-200 dark:border-gray-800"
            }`}
          >
            <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-50 mb-6">
              Photos and Videos <span className="text-red-500">*</span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
              {images.length
                ? images.map((img, i) => (
                    <div key={i} className="relative group">
                      {img.type === "video" ? (
                        <video
                          src={img.url}
                          aria-label={`video preview-${i}`}
                          controls
                          preload="metadata"
                          className="w-full h-24 object-contain rounded-lg bg-black"
                        />
                      ) : (
                        <img
                          src={img.url}
                          alt={`preview-${i}`}
                          className="w-full h-24 object-cover rounded-lg"
                        />
                      )}
                      <button
                        onClick={() => removeImage(i)}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="remove media"
                      >
                        ✕
                      </button>
                    </div>
                  ))
                : Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-24 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center text-gray-400 text-sm"
                    >
                      No media
                    </div>
                  ))}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept={
                hasPhoto
                  ? "image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
                  : "image/jpeg,image/png,image/webp"
              }
              onChange={onFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                // Store scroll position before opening file dialog
                scrollPositionRef.current =
                  window.scrollY || window.pageYOffset || 0;
                fileInputRef.current.click();
              }}
              disabled={images.length >= LIMITS.images}
              className={`w-full py-4 px-6 border-2 border-dashed rounded-lg font-medium transition-colors ${
                images.length >= LIMITS.images
                  ? "border-gray-300 dark:border-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed opacity-50"
                  : errors.images
                    ? "border-red-500 dark:border-red-600 text-red-600 dark:text-red-400 hover:border-red-600 dark:hover:border-red-500"
                    : "border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-200 hover:border-blue-500 hover:text-blue-600"
              }`}
            >
              {hasPhoto ? "+ Add Photos or Videos" : "+ Add a Photo"}
            </button>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-3 text-center">
              At least one photo is required. Add up to {LIMITS.images} photos
              and videos total; videos can be up to 25 MB.
              {images.length >= LIMITS.images && (
                <span className="block mt-1 text-gray-600 dark:text-gray-300 font-medium">
                  Maximum {LIMITS.images} media files reached.
                </span>
              )}
            </p>
            {errors.images && (
              <p className="text-red-600 dark:text-red-400 text-sm mt-2 text-center">
                {errors.images}
              </p>
            )}
          </div>
          <SafetyTips />
          <ListingActions
            atListingCap={atListingCap}
            catFetchError={catFetchError}
            catLoading={catLoading}
            isEdit={isEdit}
            isNew={isNew}
            loadingExisting={loadingExisting}
            listingStatus={listingStatus}
            location={location}
            navigate={navigate}
            publishListing={publishListing}
            saveDraft={saveDraft}
            submitting={submitting}
          />{" "}
        </div>
      </div>
    </div>
  );
}
