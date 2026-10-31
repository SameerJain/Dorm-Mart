import { useId } from "react";
import { MEET_LOCATION_OPTIONS } from "../../../constants/meetLocations";
import { decimalNumericKeyDownHandler } from "../../../utils/numericInputKeyHandlers";
import {
  CATEGORIES_MAX,
  hasListingPhoto,
  LIMITS,
} from "../utils/listingFormConfig";
import ListingActions from "./ListingActions";
import SafetyTips from "./SafetyTips";
import { withFirstFrame } from "../../../utils/videoSrc";

const errorBorder = (error) =>
  error
    ? "border-red-500 bg-red-50/70 dark:bg-red-950/20"
    : "border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900";

const inputClass = (error, extra = "") =>
  `w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${extra} ${errorBorder(error)}`;

const labelClass =
  "block text-base font-semibold text-gray-900 dark:text-gray-100 mb-2";

function Required() {
  return <span className="text-red-500">*</span>;
}

function FieldError({ error, className = "" }) {
  return error ? (
    <p className={`mt-1 text-sm text-red-600 dark:text-red-400 ${className}`}>
      {error}
    </p>
  ) : null;
}

// One card per group of related fields, so every section reads the same way.
function Section({ title, description, required, error, children }) {
  return (
    <section
      className={`rounded-2xl border bg-white p-4 shadow-sm sm:p-6 dark:bg-gray-950/50 ${
        error
          ? "border-red-500 dark:border-red-600"
          : "border-gray-200 dark:border-gray-800"
      }`}
    >
      <h2 className="text-xl font-bold text-gray-900 dark:text-gray-50">
        {title} {required && <Required />}
      </h2>
      {description && (
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {description}
        </p>
      )}
      <div className="mt-5 space-y-6">{children}</div>
    </section>
  );
}

function ToggleOption({ checked, description, label, onChange }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg bg-gray-50 p-4 dark:bg-gray-900/30">
      <span>
        <span className="block text-base font-medium text-gray-900 dark:text-gray-100">
          {label}
        </span>
        <span className="block text-sm text-gray-600 dark:text-gray-400">
          {description}
        </span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-5 w-5 shrink-0 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
      />
    </label>
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
  const ids = {
    title: useId(),
    condition: useId(),
    categories: useId(),
    description: useId(),
    price: useId(),
    location: useId(),
  };

  return (
    <div ref={formTopRef}>
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
        <div className="space-y-6 lg:col-span-2">
          <Section
            title="Basic Information"
            description="What you're selling, what shape it's in, and where it belongs."
          >
            <div>
              <label htmlFor={ids.title} className={labelClass}>
                Item Title <Required />
              </label>
              <input
                id={ids.title}
                value={title}
                onChange={(e) =>
                  handleInputChange("title", e.target.value, setTitle)
                }
                aria-invalid={Boolean(errors.title)}
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

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:items-start">
              <div>
                <label htmlFor={ids.condition} className={labelClass}>
                  Item Condition <Required />
                </label>
                <select
                  id={ids.condition}
                  value={condition}
                  onChange={(e) => {
                    setCondition(e.target.value);
                    clearError("condition");
                  }}
                  aria-invalid={Boolean(errors.condition)}
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

              <div>
                <label htmlFor={ids.categories} className={labelClass}>
                  Categories <Required />
                </label>
                <div className="flex flex-col gap-2">
                  <select
                    id={ids.categories}
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
                    aria-invalid={Boolean(errors.categories)}
                    className={`w-full rounded-lg border px-4 py-3 transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500 ${
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

                  {categories.length > 0 && (
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
                            className="-my-1 -mr-2 px-2 py-1 coarse:-my-2 coarse:py-2 text-blue-600 dark:text-blue-200 hover:text-blue-800 dark:hover:text-white"
                          >
                            ✕
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

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

            <div>
              <label htmlFor={ids.description} className={labelClass}>
                Description <Required />
              </label>
              <textarea
                id={ids.description}
                value={description}
                onChange={(e) =>
                  handleInputChange(
                    "description",
                    e.target.value,
                    setDescription,
                  )
                }
                rows={6}
                aria-invalid={Boolean(errors.description)}
                className={inputClass(errors.description, "resize-none")}
                placeholder="Describe the item: condition, usage, and history."
                maxLength={LIMITS.description}
              />
              <div className="flex justify-end items-center mt-2">
                <p className="text-sm text-gray-400 dark:text-gray-500">
                  {description.length}/{LIMITS.description}
                </p>
              </div>
              <FieldError error={errors.description} />
            </div>
          </Section>

          <Section
            title="Location"
            description="Where buyers can pick the item up."
          >
            <div>
              <label htmlFor={ids.location} className={labelClass}>
                Item Location <Required />
              </label>
              <select
                id={ids.location}
                value={itemLocation}
                onChange={(e) => {
                  setItemLocation(e.target.value);
                  clearError("itemLocation");
                }}
                aria-invalid={Boolean(errors.itemLocation)}
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
          </Section>

          <Section
            title="Pricing"
            description="What you're asking, and whether you're open to offers."
          >
            <div>
              <label htmlFor={ids.price} className={labelClass}>
                Price <Required />
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-lg">
                  $
                </span>
                <input
                  id={ids.price}
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
                  aria-invalid={Boolean(errors.price)}
                  className={`w-full rounded-lg border py-3 pl-8 pr-4 transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500 ${errorBorder(errors.price)}`}
                  placeholder="0.00"
                />
              </div>
              <FieldError error={errors.price} />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
          </Section>

          <Section
            title="Photos and Videos"
            required
            error={errors.images}
            description={`At least one photo is required to publish. Drafts can be saved without photos. Add up to ${LIMITS.images} photos and videos total; videos can be up to 25 MB.`}
          >
            <div>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 sm:gap-4 mb-4">
                {images.length
                  ? images.map((img, i) => (
                      <div key={i} className="relative group">
                        {img.type === "video" ? (
                          <video
                            src={withFirstFrame(img.url)}
                            aria-label={`video preview-${i}`}
                            controls
                            playsInline
                            disablePictureInPicture
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
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 coarse:w-8 coarse:h-8 flex items-center justify-center text-xs mouse:opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
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
              {images.length >= LIMITS.images && (
                <p className="mt-3 text-center text-sm font-medium text-gray-600 dark:text-gray-300">
                  Maximum {LIMITS.images} media files reached.
                </p>
              )}
              {errors.images && (
                <p className="text-red-600 dark:text-red-400 text-sm mt-2 text-center">
                  {errors.images}
                </p>
              )}
            </div>
          </Section>
        </div>

        {/* Below the form on small screens (tips, then buttons last); a column
            that stays in view while scrolling on large ones. */}
        <aside className="flex flex-col gap-6 lg:sticky lg:top-6">
          <ListingActions
            className="order-2 lg:order-1"
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
          />
          <SafetyTips className="order-1 lg:order-2" />
        </aside>
      </div>
    </div>
  );
}
