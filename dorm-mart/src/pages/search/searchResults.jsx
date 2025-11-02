// src/pages/search/searchResults.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const PUBLIC_BASE = (process.env.PUBLIC_URL || "").replace(/\/$/, "");
const API_BASE = (process.env.REACT_APP_API_BASE || `${PUBLIC_BASE}/api`).replace(/\/$/, "");

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

export default function SearchResults() {
  const navigate = useNavigate();
  const query = useQuery();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [items, setItems] = useState([]);

  // Build a payload from the query string
  const payload = useMemo(() => {
    const q = query.get("q") || query.get("search") || null;
    const category = query.get("category") || null;
    const sort = query.get("sort") || null; // e.g. 'new', 'price_asc', 'price_desc'
    const condition = query.get("condition") || null; // e.g. 'New', 'Used'
    const location = query.get("location") || null; // campus/location
    const minPrice = query.get("minPrice") || null;
    const maxPrice = query.get("maxPrice") || null;
    const status = query.get("status") || null; // e.g. 'AVAILABLE'

    const p = {};
    if (q) p.q = q;
    if (category) p.category = category;
    if (sort) p.sort = sort;
    if (condition) p.condition = condition;
    if (location) p.location = location;
    if (minPrice) p.minPrice = minPrice;
    if (maxPrice) p.maxPrice = maxPrice;
    if (status) p.status = status;
    return p;
  }, [query]);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const r = await fetch(`${API_BASE}/search/getSearchItems.php`, {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
          credentials: "include",
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        const arr = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
        const normalized = arr.map((d, i) => {
          const id = d.id ?? d.product_id ?? i;
          const priceRaw = d.price ?? d.listing_price ?? null;
          const price = typeof priceRaw === "number"
            ? priceRaw
            : priceRaw != null
            ? parseFloat(String(priceRaw).replace(/[^0-9.]/g, "")) || 0
            : 0;

          const rawImg = d.image || d.image_url || d.photo || null;
          const img = rawImg
            ? `${API_BASE}/image.php?url=${encodeURIComponent(String(rawImg))}`
            : null;

          const seller = d.seller || d.seller_name || d.sold_by || (d.seller_id != null ? `Seller #${d.seller_id}` : "Unknown Seller");
          const createdAt = d.created_at || d.date_listed || null;
          const createdAtDate = createdAt ? new Date(createdAt) : null;
          const itemCondition = d.item_condition || d.condition || null;
          const itemLocation = d.item_location || d.meet_location || d.location || null;
          const status = d.status || (createdAtDate && !isNaN(createdAtDate) && (Date.now() - createdAtDate.getTime()) / 36e5 < 48 ? "JUST POSTED" : "AVAILABLE");

          return {
            id,
            title: d.title || d.product_title || "Untitled",
            price,
            img,
            seller,
            createdAt: createdAtDate,
            itemCondition,
            itemLocation,
            status,
          };
        });
        setItems(normalized);
      } catch (e) {
        if (e.name !== "AbortError") {
          console.error("getSearchItems failed:", e);
          setError(e);
          setItems([]);
        }
      } finally {
        setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [payload]);

  const titleText = useMemo(() => {
    const parts = [];
    if (payload.q) parts.push(`"${payload.q}"`);
    if (payload.category) parts.push(`${payload.category}`);
    return parts.length ? `Results for ${parts.join(" ")}` : "All Listings";
  }, [payload]);

  const formatDate = (d) => {
    if (!(d instanceof Date) || isNaN(d)) return "";
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <div className="w-full border-b border-gray-200 bg-white/80 backdrop-blur px-2 md:px-4 py-3 flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="text-sm text-blue-600 hover:underline">Back</button>
        <h1 className="text-base md:text-lg font-semibold text-gray-900">{titleText}</h1>
        <div />
      </div>

      <div className="w-full px-2 md:px-4 py-4">
        {/* Loading / Error / Empty states */}
        {loading ? (
          <p className="text-center text-sm text-gray-400">Searching…</p>
        ) : error ? (
          <p className="text-center text-sm text-red-500">Could not fetch search results.</p>
        ) : items.length === 0 ? (
          <p className="text-center text-sm text-gray-400">No items found.</p>
        ) : (
          <ul className="space-y-3">
            {items.map((it) => (
              <li key={it.id}>
                <button
                  onClick={() => navigate(`/app/viewProduct/${encodeURIComponent(it.id)}`)}
                  className="w-full text-left bg-white rounded-lg border border-gray-200/70 shadow-sm hover:border-blue-200 transition p-3"
                >
                  <div className="grid grid-cols-[4.5rem,1fr,6.5rem] md:grid-cols-[6rem,1fr,8rem] gap-3 items-center">
                    {/* Photo */}
                    <div className="h-20 w-20 md:h-24 md:w-24 rounded-md overflow-hidden bg-gray-100 border border-gray-200">
                      {it.img ? (
                        <img src={it.img} alt={it.title} className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-xs text-gray-400">No image</div>
                      )}
                    </div>

                    {/* Middle details */}
                    <div className="flex flex-col gap-0.5 md:gap-1 pr-2">
                      <p className="text-sm md:text-base font-semibold text-gray-900 line-clamp-1">{it.title}</p>
                      <p className="text-xs md:text-sm text-gray-600">
                        {it.itemCondition ? <><span className="font-medium">Condition:</span> {it.itemCondition} · </> : null}
                        {it.itemLocation ? <><span className="font-medium">Location:</span> {it.itemLocation} · </> : null}
                        <span className="font-medium">Seller:</span> {it.seller}
                      </p>
                      <p className="text-xs text-gray-400">{it.createdAt ? `Posted ${formatDate(it.createdAt)}` : null}</p>
                    </div>

                    {/* Right price + status */}
                    <div className="flex flex-col items-end gap-1">
                      <div className="text-base md:text-lg font-bold text-gray-900">${it.price?.toFixed(2)}</div>
                      {it.status ? (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                          String(it.status).toUpperCase() === "JUST POSTED"
                            ? "bg-green-50 text-green-700 border-green-200"
                            : String(it.status).toUpperCase() === "SOLD"
                            ? "bg-gray-100 text-gray-600 border-gray-200"
                            : "bg-blue-50 text-blue-700 border-blue-200"
                        }`}>
                          {String(it.status).toUpperCase()}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

