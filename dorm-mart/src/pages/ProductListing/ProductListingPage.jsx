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
    <div className="min-h-screen bg-white">
      <main className="max-w-[1200px] mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 bg-[#fbf9f9] rounded-2xl border p-6 shadow-sm">
          <h2 className="text-3xl font-bold text-center mb-4">{headerText}</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1">
              <label className="block text-xl font-semibold mb-2">Item Title</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full p-3 border rounded-lg" placeholder="Item title" />

              <p className="text-xs text-gray-400 mt-2">Be specific and descriptive to attract buyers</p>

              <label className="block text-xl font-semibold mt-6 mb-2">Category</label>
              <input value={category} onChange={(e) => setCategory(e.target.value)} className="w-full p-3 border rounded-lg" />

              <label className="block text-xl font-semibold mt-6 mb-2">Tags</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {tags.map((t) => (
                  <span key={t} className="flex items-center gap-2 bg-slate-100 rounded-full px-3 py-1">
                    <span className="text-sm font-medium">{t}</span>
                    <button onClick={() => removeTag(t)} aria-label={`remove ${t}`} className="text-gray-500">✕</button>
                  </span>
                ))}
              </div>
              <div className="flex flex-col gap-2">
                <input value={newTag} onChange={(e) => setNewTag(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())} className="flex-1 p-2 border rounded-lg" placeholder="Add tag and press Enter" />
                <button onClick={addTag} className="px-4 py-2 rounded bg-[#153243] text-white">Add</button>
              </div>

              <label className="block text-xl font-semibold mt-6 mb-2">Meet Location</label>
              <select value={meetLocation} onChange={(e) => setMeetLocation(e.target.value)} className="w-full p-3 border rounded-lg" >
                <option>North Campus</option>
                <option>South Campus</option>
              </select>

              <label className="block text-xl font-semibold mt-6 mb-2">Item Condition</label>
              <select value={condition} onChange={(e) => setCondition(e.target.value)} className="w-full p-3 border rounded-lg">
                <option>Like New</option>
                <option>Good</option>
                <option>Fair</option>
                <option>For Parts</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xl font-semibold mb-2">Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={14} className="w-full p-4 border rounded-lg resize-none" />
            </div>
          </div>
        </section>

        <aside className="space-y-6">
          <section className="bg-[#fbf9f9] rounded-2xl border p-4 shadow-sm">
            <h3 className="text-2xl font-bold text-center mb-4">Photos & Media</h3>

            <div className="grid grid-cols-3 gap-3 mb-4">
              {images.length ? (
                images.map((img, i) => (
                  <div key={i} className="relative">
                    <img src={img.url} alt={`preview-${i}`} className="w-full h-28 object-cover rounded" />
                    <button onClick={() => removeImage(i)} className="absolute top-1 right-1 bg-white/80 rounded-full px-2 py-1 text-sm" aria-label="remove image">✕</button>
                  </div>
                ))
              ) : (
                <>
                  <div className="h-28 bg-white/60 rounded flex items-center justify-center text-gray-400">No photo</div>
                  <div className="h-28 bg-white/60 rounded flex items-center justify-center text-gray-400">No photo</div>
                  <div className="h-28 bg-white/60 rounded flex items-center justify-center text-gray-400">No photo</div>
                </>
              )}
            </div>

            <div className="flex items-center gap-3">
              <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={onFileChange} className="hidden" />
              <button onClick={() => fileInputRef.current.click()} className="px-4 py-2 rounded border">Click to add more photos</button>
              <p className="text-xs text-gray-400 ml-2">Recommended: Take photos in good lighting from multiple angles</p>
            </div>
          </section>

          <section className="bg-slate-100 rounded-2xl border p-4 shadow-sm">
            <h3 className="text-2xl font-bold text-center mb-3">Pricing Options</h3>
            <div className="flex items-center gap-4 mb-4">
              <label className="text-lg font-semibold">$</label>
              <input type="number" value={price} onChange={(e) => setPrice(parseFloat(e.target.value || 0))} className="w-32 p-2 border rounded-lg" step="0.5" min="0" />
              <div className="flex items-center gap-2 ml-auto">
                <label>Accepting Trades?</label>
                <input type="checkbox" checked={acceptTrades} onChange={() => setAcceptTrades((s) => !s)} />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <label>Price Negotiable?</label>
              <input type="checkbox" checked={priceNegotiable} onChange={() => setPriceNegotiable((s) => !s)} />
            </div>
          </section>

          <section className="bg-slate-50 rounded-2xl border p-4 shadow-sm">
            <h3 className="text-2xl font-bold text-[#153243] text-center mb-3">Safety Tips</h3>
            <ul className="text-sm text-[#153243c7] space-y-2">
              <li>Consider bringing a friend, especially for high value items</li>
              <li>Report suspicious messages or behavior</li>
              <li>Trust your gut. If something feels off, don’t proceed</li>
              <li>Keep receipts or transaction records</li>
              <li>Use secure payment methods (cash, Venmo, Zelle)</li>
            </ul>
          </section>

          <div className="flex gap-3">
            <button onClick={saveDraft} className="flex-1 py-3 rounded bg-yellow-500 text-white font-bold">Save Draft</button>
            <button onClick={publishListing} className="flex-1 py-3 rounded bg-green-700 text-white font-bold">Publish <span className="block">Listing</span></button>
            <button onClick={() => alert("Discarded")} className="flex-1 py-3 rounded border">Discard Changes</button>
          </div>
        </aside>
      </main>
    </div>
  );
}
export default ProductListingPage;