// pages/ProductListing/ProductListingPage.jsx
import React, { useState, useRef, useEffect } from "react";
import { useParams, useMatch } from "react-router-dom";

/**
 * ProductListingPage supports three modes:
 *  - index  => visiting /product-listing                 (no :id, not /new)
 *  - new    => visiting /product-listing/new             (useMatch('/product-listing/new'))
 *  - edit   => visiting /product-listing/edit/:id        (useParams().id exists)
 */


// Ensure this is a default export
function ProductListingPage() {
  const { id } = useParams(); // edit id if present
  const matchNew = useMatch("/product-listing/new");
  const isEdit = Boolean(id);
  const isNew = Boolean(matchNew);
  const isIndex = !isEdit && !isNew;

  const defaultForm = {
    title: "Shower Caddy",
    category: "Dorm",
    tags: ["Blue", "Bathroom Organizer"],
    meetLocation: "North Campus",
    condition: "Like New",
    description:
      "Gently used blue plastic shower caddy with multiple compartments. Perfect for carrying shampoo, conditioner...",
    price: 10.0,
    acceptTrades: false,
    priceNegotiable: false,
    images: [],
  };

  // form state
  const [title, setTitle] = useState(defaultForm.title);
  const [category, setCategory] = useState(defaultForm.category);
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

  // --- mode-aware lifecycle ---
  useEffect(() => {
    if (isEdit) {
      // Mock fetch — replace with real API call
      const mockData = {
        title: `Shower Caddy #${id}`,
        category: "Dorm",
        tags: ["Blue", "Bathroom Organizer", "Campus"],
        meetLocation: "Ellicott",
        condition: "Good",
        description: `Loaded data for item ${id}. This description is fetched from the server.`,
        price: 12.5,
        acceptTrades: true,
        priceNegotiable: true,
        images: [],
      };

      setTitle(mockData.title);
      setCategory(mockData.category);
      setTags(mockData.tags);
      setMeetLocation(mockData.meetLocation);
      setCondition(mockData.condition);
      setDescription(mockData.description);
      setPrice(mockData.price);
      setAcceptTrades(Boolean(mockData.acceptTrades));
      setPriceNegotiable(Boolean(mockData.priceNegotiable));
    } else if (isNew) {
      // reset to defaults
      setTitle(defaultForm.title);
      setCategory(defaultForm.category);
      setTags([...defaultForm.tags]);
      setMeetLocation(defaultForm.meetLocation);
      setCondition(defaultForm.condition);
      setDescription(defaultForm.description);
      setPrice(defaultForm.price);
      setAcceptTrades(defaultForm.acceptTrades);
      setPriceNegotiable(defaultForm.priceNegotiable);
      setImages([]);
      setNewTag("");
    } else {
      // index: do nothing (or load listing list)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isNew]);

  // --- tag helpers ---
  function addTag() {
    const t = newTag.trim();
    if (!t) return;
    if (!tags.includes(t)) setTags((s) => [...s, t]);
    setNewTag("");
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

  // --- submit stubs ---
  function saveDraft() {
    const payload = {
      title,
      category,
      tags,
      meetLocation,
      condition,
      description,
      price,
      acceptTrades,
      priceNegotiable,
    };
    console.log("Save Draft", payload);
    alert("Draft saved (console)");
  }

  function publishListing() {
    if (!title.trim()) return alert("Enter a title");
    if (!price && price !== 0) return alert("Enter a price");
    console.log("Publish", { title, price, tags, images, mode: isEdit ? "edit" : isNew ? "new" : "index" });
    alert("Publish called (console)");
  }

  const headerText = isEdit ? `Edit Product (ID: ${id})` : isNew ? "Create New Product" : "Product Listing";

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-6xl mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-blue-600 mb-2">{headerText}</h1>
          <p className="text-gray-600">Fill out the form below to {isEdit ? 'update your listing' : 'create your listing'}</p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 lg:gap-8">
          {/* Main Form Section */}
          <div className="xl:col-span-2 space-y-6">
            {/* Basic Information Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Basic Information</h2>
              
              <div className="space-y-6">
                {/* Title */}
                <div>
                  <label className="block text-lg font-semibold text-gray-900 mb-2">
                    Item Title <span className="text-red-500">*</span>
                  </label>
                  <input 
                    value={title} 
                    onChange={(e) => setTitle(e.target.value)} 
                    className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" 
                    placeholder="Enter a descriptive title for your item"
                  />
                  <p className="text-sm text-gray-500 mt-2">Be specific and descriptive to attract buyers</p>
                </div>

                {/* Category and Condition Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-lg font-semibold text-gray-900 mb-2">Category</label>
                    <input 
                      value={category} 
                      onChange={(e) => setCategory(e.target.value)} 
                      className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      placeholder="e.g., Electronics, Furniture, Books"
                    />
                  </div>
                  <div>
                    <label className="block text-lg font-semibold text-gray-900 mb-2">Item Condition</label>
                    <select 
                      value={condition} 
                      onChange={(e) => setCondition(e.target.value)} 
                      className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    >
                      <option>Like New</option>
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
                      <span key={t} className="flex items-center gap-2 bg-blue-100 text-blue-800 rounded-full px-3 py-1">
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
                      onChange={(e) => setNewTag(e.target.value)} 
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())} 
                      className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" 
                      placeholder="Add tag and press Enter"
                    />
                    <button 
                      onClick={addTag} 
                      className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                    >
                      Add
                    </button>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-lg font-semibold text-gray-900 mb-2">Description</label>
                  <textarea 
                    value={description} 
                    onChange={(e) => setDescription(e.target.value)} 
                    rows={6} 
                    className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-none" 
                    placeholder="Describe your item in detail. Include any relevant information about its condition, usage, or history."
                  />
                </div>
              </div>
            </div>

            {/* Location and Pricing Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Location & Pricing</h2>
              
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
                    <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 text-lg">$</span>
                    <input 
                      type="number" 
                      value={price} 
                      onChange={(e) => setPrice(parseFloat(e.target.value || 0))} 
                      className="w-full pl-8 pr-4 py-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" 
                      step="0.01" 
                      min="0" 
                      placeholder="0.00"
                    />
                  </div>
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
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Photos Section */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Photos & Media</h3>
              
              <div className="grid grid-cols-2 gap-3 mb-4">
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
                    <div className="h-24 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 text-sm">No photo</div>
                    <div className="h-24 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 text-sm">No photo</div>
                  </>
                )}
              </div>

              <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={onFileChange} className="hidden" />
              <button 
                onClick={() => fileInputRef.current.click()} 
                className="w-full py-3 px-4 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-600 transition-colors"
              >
                + Add Photos
              </button>
              <p className="text-xs text-gray-500 mt-2">Recommended: Take photos in good lighting from multiple angles</p>
            </div>

            {/* Safety Tips */}
            <div className="bg-blue-50 rounded-2xl border border-blue-200 p-6">
              <h3 className="text-xl font-bold text-blue-900 mb-4">Safety Tips</h3>
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
                  <span>Trust your gut. If something feels off, don't proceed</span>
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
            <div className="space-y-3">
              <button 
                onClick={publishListing} 
                className="w-full py-4 bg-blue-600 text-white rounded-lg font-bold text-lg hover:bg-blue-700 transition-colors"
              >
                {isEdit ? 'Update Listing' : 'Publish Listing'}
              </button>
              <button 
                onClick={saveDraft} 
                className="w-full py-3 bg-yellow-500 text-white rounded-lg font-medium hover:bg-yellow-600 transition-colors"
              >
                Save Draft
              </button>
              <button 
                onClick={() => alert("Discarded")} 
                className="w-full py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                Discard Changes
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
export default ProductListingPage;