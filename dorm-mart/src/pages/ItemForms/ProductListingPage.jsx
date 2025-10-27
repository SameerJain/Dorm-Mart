// pages/ItemForms/ProductListingPage.jsx
import React, { useState, useRef, useEffect } from "react";
import { useParams, useMatch, useNavigate } from "react-router-dom";

/**
 * ProductListingPage supports three modes:
 *  - index  => visiting /product-listing                 (no :id, not /new)
 *  - new    => visiting /product-listing/new             (useMatch('/product-listing/new'))
 *  - edit   => visiting /product-listing/edit/:id        (useParams().id exists)
 */

function ProductListingPage() {
  const { id } = useParams(); // edit id if present
  const matchNew = useMatch("/product-listing/new");
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const isNew = Boolean(matchNew);

  const defaultForm = {
    title: "",
    tags: [],
    meetLocation: "North Campus",
    condition: "Excellent",
    description: "",
    price: 0,
    acceptTrades: false,
    priceNegotiable: false,
    images: [],
  };

  // form state
  const [title, setTitle] = useState(defaultForm.title);
  const [tags, setTags] = useState(defaultForm.tags);
  const [newTag, setNewTag] = useState("");
  const [meetLocation, setMeetLocation] = useState(defaultForm.meetLocation);
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

  // Character limits
  const LIMITS = {
    title: 70,
    description: 1000,
    tag: 30,
    price: 999999.99,
  };

  // Input validation and change handlers
  const handleInputChange = (field, value, setter) => {
    if (field === "title" && value.length > LIMITS.title) return;
    if (field === "description" && value.length > LIMITS.description) return;
    if (field === "newTag" && value.length > LIMITS.tag) return;
    if (field === "price" && value > LIMITS.price) return;

    setter(value);

    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validateAll = () => {
    const newErrors = {};

    if (!title.trim()) newErrors.title = "Title is required";
    else if (title.length > LIMITS.title) newErrors.title = `Title must be ${LIMITS.title} characters or fewer`;

    if (!description.trim()) newErrors.description = "Description is required";
    else if (description.length > LIMITS.description)
      newErrors.description = `Description must be ${LIMITS.description} characters or fewer`;

    if (price === "" || price === 0) newErrors.price = "Price is required";
    else if (price < 0) newErrors.price = "Price must be positive";
    else if (price > LIMITS.price) newErrors.price = `Price must be $${LIMITS.price} or less`;

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // --- mode-aware lifecycle ---
  useEffect(() => {
    if (isEdit) {
      // Load existing item here if needed (via GET) – omitted per request.
    } else if (isNew) {
      setTitle(defaultForm.title);
      setTags([...defaultForm.tags]);
      setMeetLocation(defaultForm.meetLocation);
      setCondition(defaultForm.condition);
      setDescription(defaultForm.description);
      setPrice(defaultForm.price);
      setAcceptTrades(defaultForm.acceptTrades);
      setPriceNegotiable(defaultForm.priceNegotiable);
      setImages([]);
      setNewTag("");
      setErrors({});
      setServerMsg(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isNew]);

  // --- tag helpers ---
  function addTag() {
    const t = newTag.trim();
    if (!t) return;
    if (t.length > LIMITS.tag) {
      setErrors((prev) => ({ ...prev, newTag: `Tag must be ${LIMITS.tag} characters or fewer` }));
      return;
    }
    if (!tags.includes(t)) setTags((s) => [...s, t]);
    setNewTag("");
    setErrors((prev) => {
      const ne = { ...prev };
      delete ne.newTag;
      return ne;
    });
  }
  function removeTag(t) {
    setTags((s) => s.filter((x) => x !== t));
  }

  // --- image upload ---
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

  // --- submit: POST to api/product_listing.php ---
  async function publishListing(e) {
    e.preventDefault();
    setServerMsg(null);
    if (!validateAll()) return;

    const fd = new FormData();
    fd.append("mode", isEdit ? "update" : "create");
    if (isEdit) fd.append("id", String(id));

    fd.append("title", title.trim());
    tags.forEach((t) => fd.append("tags[]", t));
    fd.append("meetLocation", meetLocation);
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
      const res = await fetch("api/product_listing.php", {
        method: "POST",
        body: fd,
        credentials: "include",
      });

      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error("Server returned non-JSON response.");
      }

      if (!data?.ok) {
        setServerMsg(data?.message || "Submission failed.");
        return;
      }

      // Success – navigate or show message
      navigate("/app/seller-dashboard");
    } catch (err) {
      setServerMsg(err?.message || "Network error.");
    } finally {
      setSubmitting(false);
    }
  }

  const headerText = isEdit ? "Edit Product Listing" : "New Product Listing";

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

        {serverMsg && (
          <div className="mb-4 rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">{serverMsg}</div>
        )}

        <div className="space-y-6">
          {/* Basic Information Card */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Basic Information</h2>

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

              {/* Condition only (Category removed) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-lg font-semibold text-gray-900 mb-2">Item Condition</label>
                  <select
                    value={condition}
                    onChange={(e) => setCondition(e.target.value)}
                    className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  >
                    <option>Like New</option>
                    <option>Excellent</option>
                    <option>Good</option>
                    <option>Fair</option>
                    <option>For Parts</option>
                  </select>
                </div>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-lg font-semibold text-gray-900 mb-2">Tags</label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {tags.map((t) => (
                    <span
                      key={t}
                      className="flex items-center gap-2 bg-blue-100 text-blue-800 rounded-full px-3 py-1"
                    >
                      <span className="text-sm font-medium">{t}</span>
                      <button
                        onClick={() => removeTag(t)}
                        aria-label={`remove ${t}`}
                        className="text-blue-600 hover:text-blue-800 transition-colors"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    value={newTag}
                    onChange={(e) => handleInputChange("newTag", e.target.value, setNewTag)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
                    className={`flex-1 p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                      errors.newTag ? "border-red-500 bg-red-50" : "border-gray-300"
                    }`}
                    placeholder="Add tag and press Enter"
                    maxLength={LIMITS.tag}
                  />
                  <button
                    onClick={addTag}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    Add
                  </button>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <p className="text-sm text-gray-500">Add tags to help buyers find your item</p>
                  <p className="text-sm text-gray-400">{newTag.length}/{LIMITS.tag}</p>
                </div>
                {errors.newTag && <p className="text-red-600 text-sm mt-1">{errors.newTag}</p>}
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

          {/* Location and Pricing Card */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Location & Pricing</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-lg font-semibold text-gray-900 mb-2">Meet Location</label>
                <select
                  value={meetLocation}
                  onChange={(e) => setMeetLocation(e.target.value)}
                  className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                >
                  <option>North Campus</option>
                  <option>South Campus</option>
                  <option>Ellicott</option>
                  <option>Other</option>
                </select>
              </div>

              <div>
                <label className="block text-lg font-semibold text-gray-900 mb-2">
                  Price <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-lg">$</span>
                  <input
                    type="number"
                    value={price || ""}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === "") {
                        handleInputChange("price", "", setPrice);
                      } else {
                        const numValue = parseFloat(value);
                        if (!isNaN(numValue)) {
                          handleInputChange("price", numValue, setPrice);
                        }
                      }
                    }}
                    className={`w-full pl-8 pr-4 py-4 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                      errors.price ? "border-red-500 bg-red-50" : "border-gray-300"
                    }`}
                    step="0.01"
                    min="0"
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

            {/* Photos Section */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mt-6">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Photos & Media</h3>

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
                  <>
                    <div className="h-24 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 text-sm">
                      No photo
                    </div>
                    <div className="h-24 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 text-sm">
                      No photo
                    </div>
                    <div className="h-24 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 text-sm">
                      No photo
                    </div>
                    <div className="h-24 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 text-sm">
                      No photo
                    </div>
                    <div className="h-24 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 text-sm">
                      No photo
                    </div>
                    <div className="h-24 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 text-sm">
                      No photo
                    </div>
                  </>
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
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-1">•</span>
                  <span>Consider bringing a friend, especially for high value items</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-1">•</span>
                  <span>Report suspicious messages or behavior</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-1">•</span>
                  <span>Trust your gut. Don't proceed if something feels off</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-1">•</span>
                  <span>Keep receipts or transaction records</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-1">•</span>
                  <span>Use secure payment methods (cash, Venmo, Zelle)</span>
                </li>
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mt-6">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Publish Your Listing</h3>
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={publishListing}
                  disabled={submitting}
                  className="flex-1 py-4 bg-blue-600 text-white rounded-lg font-bold text-lg hover:bg-blue-700 transition-colors disabled:opacity-60"
                >
                  {submitting ? "Submitting..." : isEdit ? "Update Listing" : "Publish Listing"}
                </button>
                <button
                  onClick={() => navigate("/app/seller-dashboard")}
                  className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                >
                  Discard Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
export default ProductListingPage;
