// pages/ItemForms/ProductListingPage.jsx
import React, { useState, useRef, useEffect } from "react";
import { useParams, useMatch, useNavigate } from "react-router-dom";

/**
 * ProductListingPage supports three modes:
 *  - index  => visiting /product-listing
 *  - new    => visiting /product-listing/new
 *  - edit   => visiting /product-listing/edit/:id
 */

function ProductListingPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  // robust matcher for /product-listing/new in different mount contexts
  const matchNewAbs = useMatch({ path: "/product-listing/new", end: true });
  const matchNewApp = useMatch({ path: "/app/product-listing/new", end: true });
  const matchNewRel = useMatch({ path: "new", end: true });
  const isNew = !isEdit && Boolean(matchNewAbs || matchNewApp || matchNewRel);
  const defaultForm = {
    title: "",
    categories: [],
    itemLocation: "",
    condition: "",
    description: "",
    price: "",
    acceptTrades: false,
    priceNegotiable: false,
    images: [],
  };

  // form state
  const [title, setTitle] = useState(defaultForm.title);
  const [categories, setCategories] = useState(defaultForm.categories);
  const [itemLocation, setItemLocation] = useState(defaultForm.itemLocation);
  const [condition, setCondition] = useState(defaultForm.condition);
  const [description, setDescription] = useState(defaultForm.description);
  const [price, setPrice] = useState(defaultForm.price);
  const [acceptTrades, setAcceptTrades] = useState(defaultForm.acceptTrades);
  const [priceNegotiable, setPriceNegotiable] = useState(defaultForm.priceNegotiable);
  const [images, setImages] = useState([]); // {file, url}
  const fileInputRef = useRef();
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [serverMsg, setServerMsg] = useState(null);

  // success modal
  const [showSuccess, setShowSuccess] = useState(false);
  const [createdProdId, setCreatedProdId] = useState(null);

  // categories dropdown state
  const [availableCategories, setAvailableCategories] = useState([]);
  const [catFetchError, setCatFetchError] = useState(null);
  const [catLoading, setCatLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(""); // "" == "<Select Option>"

  const CATEGORIES_MAX = 3;

  // limits
  const LIMITS = { title: 70, description: 1000, price: 999999.99, priceMin: 0.01 };

  // fetch categories from backend
  useEffect(() => {
    let ignore = false;
    async function loadCategories() {
      try {
        setCatLoading(true);
        setCatFetchError(null);
        const res = await fetch("api/utility/get_categories.php", { credentials: "include" });
        const text = await res.text();
        let data;
        try { data = JSON.parse(text); } catch { throw new Error("Non-JSON response from get_categories.php"); }
        if (!Array.isArray(data)) throw new Error("Expected an array of category strings");
        if (!ignore) setAvailableCategories(data.map(String));
      } catch (e) {
        if (!ignore) setCatFetchError(e?.message || "Failed to load categories.");
      } finally {
        if (!ignore) setCatLoading(false);
      }
    }
    loadCategories();
    return () => { ignore = true; };
  }, []);

  const handleInputChange = (field, value, setter) => {
    if (field === "title" && value.length > LIMITS.title) return;
    if (field === "description" && value.length > LIMITS.description) return;
    if (field === "price" && value > LIMITS.price) return;
    setter(value);
    if (errors[field]) {
      setErrors((prev) => {
        const ne = { ...prev };
        delete ne[field];
        return ne;
      });
    }
  };

  const addCategory = () => {
    if (!selectedCategory) {
      setErrors((p) => ({ ...p, categories: "Select a category" }));
      return;
    }
    if (categories.includes(selectedCategory)) return;
    if (categories.length >= CATEGORIES_MAX) {
      setErrors((p) => ({ ...p, categories: `Select at most ${CATEGORIES_MAX} categories` }));
      return;
    }
    const next = [...categories, selectedCategory];
    setCategories(next);
    setSelectedCategory("");
    setErrors((p) => {
      const ne = { ...p };
      if (next.length && next.length <= CATEGORIES_MAX) delete ne.categories;
      return ne;
    });
  };

  const removeCategory = (val) => {
    const next = categories.filter((c) => c !== val);
    setCategories(next);
    setErrors((p) => {
      const ne = { ...p };
      if (next.length && next.length <= CATEGORIES_MAX) delete ne.categories;
      return ne;
    });
  };

  const validateAll = () => {
    const newErrors = {};
    if (!title.trim()) newErrors.title = "Title is required";
    else if (title.length > LIMITS.title) newErrors.title = `Title must be ${LIMITS.title} characters or fewer`;

    if (!description.trim()) newErrors.description = "Description is required";
    else if (description.length > LIMITS.description)
      newErrors.description = `Description must be ${LIMITS.description} characters or fewer`;

    if (price === "") newErrors.price = "Price is required";
    else if (Number(price) < LIMITS.priceMin) newErrors.price = `Minimum price is $${LIMITS.priceMin.toFixed(2)}`;
    else if (Number(price) > LIMITS.price) newErrors.price = `Price must be $${LIMITS.price} or less`;

    if (!categories || categories.length === 0) newErrors.categories = "Select at least one category";
    else if (categories.length > CATEGORIES_MAX) newErrors.categories = `Select at most ${CATEGORIES_MAX} categories`;

    if (!itemLocation || itemLocation === "<Select Option>") newErrors.itemLocation = "Select an item location";
    if (!condition || condition === "<Select Option>") newErrors.condition = "Select an item condition";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // mode-aware reset
  useEffect(() => {
    if (isEdit) {
      // fetch existing if needed
    } else if (isNew) {
      setTitle(defaultForm.title);
      setCategories([...defaultForm.categories]);
      setItemLocation(defaultForm.itemLocation);
      setCondition(defaultForm.condition);
      setDescription(defaultForm.description);
      setPrice(defaultForm.price);
      setAcceptTrades(defaultForm.acceptTrades);
      setPriceNegotiable(defaultForm.priceNegotiable);
      setImages([]);
      setSelectedCategory("");
      setErrors({});
      setServerMsg(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isNew]);

  // images
  function handleFiles(files) {
    const arr = Array.from(files).slice(0, 6);
    const mapped = arr.map((file) => ({ file, url: URL.createObjectURL(file) }));
    setImages((prev) => [...prev, ...mapped]);
  }
  function removeImage(idx) {
    setImages((prev) => {
      if (prev[idx]?.url) URL.revokeObjectURL(prev[idx].url);
      return prev.filter((_, i) => i !== idx);
    });
  }
  function onFileChange(e) {
    handleFiles(e.target.files);
    e.target.value = null;
  }

  // submit
  async function publishListing(e) {
    e.preventDefault();
    setServerMsg(null);
    if (!validateAll()) return;

    const fd = new FormData();
    fd.append("mode", isEdit ? "update" : "create");
    if (isEdit) fd.append("id", String(id));
    fd.append("title", title.trim());
    categories.forEach((c) => fd.append("tags[]", c)); // backend compatibility
    fd.append("meetLocation", itemLocation); // backend compatibility
    fd.append("condition", condition);
    fd.append("description", description);
    fd.append("price", String(Number(price)));
    fd.append("acceptTrades", acceptTrades ? "1" : "0");
    fd.append("priceNegotiable", priceNegotiable ? "1" : "0");
    images.forEach((img, i) => {
      if (img?.file) fd.append("images[]", img.file, img.file.name || `image_${i}.jpg`);
    });

    try {
      setSubmitting(true);
      const res = await fetch("api/seller-dashboard/product_listing.php", {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { throw new Error("Server returned non-JSON response."); }

      if (!data?.ok) {
        setServerMsg(data?.message || data?.error || "Submission failed.");
        return;
      }

      // Expecting server to return { ok: true, prod_id: <id> } (fallback to product_id)
      const pid = data?.prod_id ?? data?.product_id ?? null;
      setCreatedProdId(pid);
      setShowSuccess(true);

      // clear form after success
      setTitle(defaultForm.title);
      setCategories([]);
      setItemLocation(defaultForm.itemLocation);
      setCondition(defaultForm.condition);
      setDescription(defaultForm.description);
      setPrice(defaultForm.price);
      setAcceptTrades(defaultForm.acceptTrades);
      setPriceNegotiable(defaultForm.priceNegotiable);
      setImages([]);
      setSelectedCategory("");
      setErrors({});
    } catch (err) {
      setServerMsg(err?.message || "Network error.");
    } finally {
      setSubmitting(false);
    }
  }

  const headerText = isEdit ? "Edit Product Listing" : "New Product Listing";
  const selectableOptions = availableCategories.filter((opt) => !categories.includes(opt));

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <main className="max-w-6xl mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-blue-600 dark:text-blue-400 mb-2">{headerText}</h1>
          <p className="text-gray-600 dark:text-gray-300">
            Fill out the form below to {isEdit ? "update your listing" : "create your listing"}
          </p>
        </div>

        {serverMsg && <div className="mb-4 rounded-lg border p-3 text-sm bg-white">{serverMsg}</div>}

        <div className="space-y-6">
          {/* Basic Information */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Basic Information</h2>

            <div className="space-y-6">
              {/* Title */}
              <div>
                <label className="block text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Item Title <span className="text-red-500">*</span>
                </label>
                <input
                  value={title}
                  onChange={(e) => handleInputChange("title", e.target.value, setTitle)}
                  className={`w-full p-4 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                    errors.title ? "border-red-500 bg-red-50" : "border-gray-300"
                  }`}
                  placeholder="Enter a descriptive title for your item"
                  maxLength={LIMITS.title}
                />
                <div className="flex justify-between items-center mt-2">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Be specific and descriptive to attract buyers</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500">{title.length}/{LIMITS.title}</p>
                </div>
                {errors.title && <p className="text-red-600 text-sm mt-1">{errors.title}</p>}
              </div>

              {/* Item Condition */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-lg font-semibold text-gray-900 mb-2">
                    Item Condition <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={condition}
                    onChange={(e) => setCondition(e.target.value)}
                    className={`w-full p-4 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                      errors.condition ? "border-red-500 bg-red-50" : "border-gray-300"
                    }`}
                  >
                    <option>{"<Select Option>"}</option>
                    <option>Like New</option>
                    <option>Excellent</option>
                    <option>Good</option>
                    <option>Fair</option>
                    <option>For Parts</option>
                  </select>
                  {errors.condition && <p className="text-red-600 text-sm mt-1">{errors.condition}</p>}
                </div>
              </div>

              {/* Categories */}
              <div>
                <label className="block text-lg font-semibold text-gray-900 mb-2">
                  Categories <span className="text-red-500">*</span>
                </label>

                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <select
                      value={selectedCategory}
                      onChange={(e) => {
                        setSelectedCategory(e.target.value);
                        if (errors.categories) {
                          setErrors((p) => {
                            const ne = { ...p };
                            delete ne.categories;
                            return ne;
                          });
                        }
                      }}
                      className={`flex-1 p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                        errors.categories ? "border-red-500 bg-red-50" : "border-gray-300"
                      }`}
                    >
                      <option value="">{`<Select Option>`}</option>
                      {catLoading && <option disabled>Loading...</option>}
                      {!catLoading && selectableOptions.length === 0 && (
                        <option disabled>{catFetchError || "No categories available"}</option>
                      )}
                      {selectableOptions.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={addCategory}
                      disabled={!selectedCategory || categories.length >= CATEGORIES_MAX}
                      className="px-5 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-60"
                    >
                      Add
                    </button>
                  </div>

                  {/* Selected chips */}
                  <div className="flex flex-wrap gap-2">
                    {categories.map((c) => (
                      <span key={c} className="flex items-center gap-2 bg-blue-100 text-blue-800 rounded-full px-3 py-1">
                        <span className="text-sm font-medium">{c}</span>
                        <button
                          type="button"
                          aria-label={`remove ${c}`}
                          onClick={() => removeCategory(c)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>

                  <div className="flex justify-between items-center">
                    <p className="text-sm text-gray-500">Select up to {CATEGORIES_MAX}.</p>
                    <p className="text-sm text-gray-400">{categories.length}/{CATEGORIES_MAX}</p>
                  </div>
                </div>

                {errors.categories && <p className="text-red-600 text-sm mt-1">{errors.categories}</p>}
              </div>

              {/* Description */}
              <div>
                <label className="block text-lg font-semibold text-gray-900 mb-2">
                  Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => handleInputChange("description", e.target.value, setDescription)}
                  rows={6}
                  className={`w-full p-4 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-none ${
                    errors.description ? "border-red-500 bg-red-50" : "border-gray-300"
                  }`}
                  placeholder="Describe your item in detail. Include any relevant information about its condition, usage, or history."
                  maxLength={LIMITS.description}
                />
                <div className="flex justify-between items-center mt-2">
                  <p className="text-sm text-gray-500">Provide detailed information about your item</p>
                  <p className="text-sm text-gray-400">{description.length}/{LIMITS.description}</p>
                </div>
                {errors.description && <p className="text-red-600 text-sm mt-1">{errors.description}</p>}
              </div>
            </div>
          </div>

          {/* Location & Pricing */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Location & Pricing</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Item Location */}
              <div>
                <label className="block text-lg font-semibold text-gray-900 mb-2">
                  Item Location <span className="text-red-500">*</span>
                </label>
                <select
                  value={itemLocation}
                  onChange={(e) => setItemLocation(e.target.value)}
                  className={`w-full p-4 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                    errors.itemLocation ? "border-red-500 bg-red-50" : "border-gray-300"
                  }`}
                >
                  <option>{"<Select Option>"}</option>
                  <option>North Campus</option>
                  <option>South Campus</option>
                  <option>Ellicott</option>
                  <option>Other</option>
                </select>
                {errors.itemLocation && <p className="text-red-600 text-sm mt-1">{errors.itemLocation}</p>}
              </div>

              {/* Price */}
              <div>
                <label className="block text-lg font-semibold text-gray-900 mb-2">
                  Price <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-lg">$</span>
                  <input
                    type="number"
                    value={price}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === "") handleInputChange("price", "", setPrice);
                      else {
                        const numValue = parseFloat(value);
                        if (!isNaN(numValue)) handleInputChange("price", numValue, setPrice);
                      }
                    }}
                    className={`w-full pl-8 pr-4 py-4 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                      errors.price ? "border-red-500 bg-red-50" : "border-gray-300"
                    }`}
                    step="0.01"
                    min={LIMITS.priceMin}
                    max={LIMITS.price}
                    placeholder="0.00"
                  />
                </div>
                {errors.price && <p className="text-red-600 text-sm mt-1">{errors.price}</p>}
              </div>
            </div>

            {/* Pricing Options */}
            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <label className="text-lg font-medium text-gray-900">Accepting Trades</label>
                  <p className="text-sm text-gray-600">Open to trade offers for your item</p>
                </div>
                <input
                  type="checkbox"
                  checked={acceptTrades}
                  onChange={() => setAcceptTrades((s) => !s)}
                  className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <label className="text-lg font-medium text-gray-900">Price Negotiable</label>
                  <p className="text-sm text-gray-600">Willing to negotiate on price</p>
                </div>
                <input
                  type="checkbox"
                  checked={priceNegotiable}
                  onChange={() => setPriceNegotiable((s) => !s)}
                  className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Photos */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mt-6">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Photos & Media</h3>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
                {images.length ? (
                  images.map((img, i) => (
                    <div key={i} className="relative group">
                      <img src={img.url} alt={`preview-${i}`} className="w-full h-24 object-cover rounded-lg" />
                      <button
                        onClick={() => removeImage(i)}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="remove image"
                      >
                        ✕
                      </button>
                    </div>
                  ))
                ) : (
                  Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-24 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 text-sm">
                      No photo
                    </div>
                  ))
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={onFileChange}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current.click()}
                className="w-full py-4 px-6 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-600 transition-colors font-medium"
              >
                + Add Photos
              </button>
              <p className="text-sm text-gray-500 mt-3 text-center">
                Recommended: Take photos in good lighting from multiple angles
              </p>
            </div>

            {/* Safety Tips */}
            <div className="bg-blue-50 rounded-2xl border border-blue-200 p-6 mt-6">
              <h3 className="text-2xl font-bold text-blue-900 mb-4">Safety Tips</h3>
              <ul className="text-sm text-blue-800 space-y-3">
                <li className="flex items-start gap-2"><span className="text-blue-600 mt-1">•</span><span>Consider bringing a friend, especially for high value items</span></li>
                <li className="flex items-start gap-2"><span className="text-blue-600 mt-1">•</span><span>Report suspicious messages or behavior</span></li>
                <li className="flex items-start gap-2"><span className="text-blue-600 mt-1">•</span><span>Trust your gut. Don't proceed if something feels off</span></li>
                <li className="flex items-start gap-2"><span className="text-blue-600 mt-1">•</span><span>Keep receipts or transaction records</span></li>
                <li className="flex items-start gap-2"><span className="text-blue-600 mt-1">•</span><span>Use secure payment methods (cash, Venmo, Zelle)</span></li>
              </ul>
            </div>

            {/* Actions */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mt-6">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Publish Your Listing</h3>
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={publishListing}
                  disabled={submitting}
                  className="flex-1 py-4 bg-blue-600 text-white rounded-lg font-bold text-lg hover:bg-blue-700 transition-colors disabled:opacity-60"
                >
                  {submitting ? "Submitting..." : isEdit ? "Update Listing" : "Publish Listing"}
                </button>

                {/* Save Draft (disabled for now) */}
                <button
                  type="button"
                  disabled
                  title="Draft saving is not available yet"
                  className="flex-1 py-3 border border-gray-300 text-gray-400 bg-gray-100 rounded-lg font-medium cursor-not-allowed"
                  aria-disabled="true"
                >
                  Save Draft
                </button>

                <button
                  onClick={() => navigate("/app/seller-dashboard")}
                  className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                  type="button"
                >
                  {isNew ? "Cancel" : "Discard Changes"}
                </button>
              </div>
              {(catLoading || catFetchError) && (
                <p className="text-sm text-gray-500 mt-4">
                  {catLoading ? "Loading categories..." : `Category load error: ${catFetchError}`}
                </p>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Success Modal */}
      {showSuccess && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="success-title"
        >
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-200">
            <div className="px-6 pt-6">
              <h2 id="success-title" className="text-2xl font-bold text-green-700">Success</h2>
              <p className="mt-2 text-gray-700">Your product posting is now visible to prospective buyers.</p>
              <p className="mt-1 text-gray-900 font-semibold">Congrats!</p>
              <p className="mt-3 text-gray-800">
                Your product id is: <span className="font-mono font-bold">{createdProdId ?? "N/A"}</span>
              </p>
            </div>
            <div className="px-6 py-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowSuccess(false)}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Post another product
              </button>
              <button
                type="button"
                onClick={() => navigate("/app/seller-dashboard")}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700"
              >
                Go back to Dashboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default ProductListingPage;
