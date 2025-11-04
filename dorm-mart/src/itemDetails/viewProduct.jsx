import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

const PUBLIC_BASE = (process.env.PUBLIC_URL || "").replace(/\/$/, "");
const API_BASE = (process.env.REACT_APP_API_BASE || `${PUBLIC_BASE}/api`).replace(/\/$/, "");

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

export default function ViewProduct() {
  const navigate = useNavigate();
  const params = useParams();
  const query = useQuery();

  const productIdFromParams = params.product_id || params.id || null;
  const productIdFromQuery = query.get("product_id") || query.get("id");
  const productId = productIdFromParams || productIdFromQuery || null;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    if (!productId) return;
    const controller = new AbortController();
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const r = await fetch(`${API_BASE}/viewProduct.php?product_id=${encodeURIComponent(productId)}`, {
          signal: controller.signal,
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const json = await r.json();
        setData(json || null);
      } catch (e) {
        if (e.name !== "AbortError") {
          console.error("viewProduct fetch failed:", e);
          setError(e);
        }
      } finally {
        setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [productId]);

  const normalized = useMemo(() => {
    if (!data) return null;

    const d = data;
    const title = d.title || d.product_title || "Untitled";
    const description = d.description || d.product_description || "";

    const priceRaw = d.listing_price ?? d.price ?? null;
    const price = typeof priceRaw === "number"
      ? priceRaw
      : priceRaw != null
      ? parseFloat(String(priceRaw).replace(/[^0-9.]/g, "")) || 0
      : 0;

    // photos can be JSON array or comma-separated string
    let photos = [];
    if (Array.isArray(d.photos)) photos = d.photos;
    else if (typeof d.photos === "string") {
      try {
        const maybeJson = JSON.parse(d.photos);
        if (Array.isArray(maybeJson)) photos = maybeJson;
        else photos = d.photos.split(",").map((s) => s.trim());
      } catch (_) {
        photos = d.photos.split(",").map((s) => s.trim());
      }
    }
    photos = (photos || []).filter(Boolean);

    // proxy remote images through image.php if present
    const photoUrls = photos.map((p) => {
      const raw = String(p);
      if (/^https?:\/\//i.test(raw)) {
        return `${API_BASE}/image.php?url=${encodeURIComponent(raw)}`;
      }
      return raw.startsWith("/") ? `${PUBLIC_BASE}${raw}` : raw;
    });

    // tags can be JSON array or comma-separated string
    let tags = [];
    if (Array.isArray(d.tags)) tags = d.tags;
    else if (typeof d.tags === "string") {
      try {
        const maybeJson = JSON.parse(d.tags);
        if (Array.isArray(maybeJson)) tags = maybeJson;
        else tags = d.tags.split(",").map((t) => t.trim()).filter(Boolean);
      } catch (_) {
        tags = d.tags.split(",").map((t) => t.trim()).filter(Boolean);
      }
    }

    const itemLocation = d.item_location || d.meet_location || d.location || null;
    const itemCondition = d.item_condition || d.condition || null;
    const trades = typeof d.trades === "boolean" ? d.trades : String(d.trades || "").toLowerCase() === "1" || String(d.trades || "").toLowerCase() === "true";
    const priceNego = typeof d.price_nego === "boolean" ? d.price_nego : String(d.price_nego || "").toLowerCase() === "1" || String(d.price_nego || "").toLowerCase() === "true";
    const sold = typeof d.sold === "boolean" ? d.sold : String(d.sold || "").toLowerCase() === "1" || String(d.sold || "").toLowerCase() === "true";

    const sellerId = d.seller_id ?? null;
    const sellerName = d.seller || (sellerId != null ? `Seller #${sellerId}` : "Unknown Seller");
    const sellerEmail = d.email || null;
    const soldTo = d.sold_to ?? null;

    const dateListedStr = d.date_listed || d.created_at || null;
    const dateSoldStr = d.date_sold || null;
    const dateListed = dateListedStr ? new Date(dateListedStr) : null;
    const dateSold = dateSoldStr ? new Date(dateSoldStr) : null;

    return {
      productId: d.product_id ?? d.id ?? null,
      title,
      description,
      price,
      photoUrls,
      tags,
      itemLocation,
      itemCondition,
      trades,
      priceNego,
      sold,
      sellerId,
      sellerName,
      soldTo,
      sellerEmail,
      dateListed,
      dateSold,
      finalPrice: d.final_price ?? null,
    };
  }, [data]);

  useEffect(() => {
    // reset active image if photos change
    setActiveIdx(0);
  }, [normalized?.photoUrls?.length]);

  const hasPrev = activeIdx > 0;
  const hasNext = normalized?.photoUrls && activeIdx < normalized.photoUrls.length - 1;

  // no-op

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <div className="w-full border-b border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-800/80 backdrop-blur px-2 md:px-4 py-3 flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="text-sm text-blue-600 dark:text-blue-300 hover:underline">Back</button>
        <h1 className="text-base md:text-lg font-semibold text-gray-900 dark:text-gray-100">Product Details</h1>
        <div />
      </div>

      <div className="w-full px-2 md:px-4 py-4">
        {loading ? (
          <p className="text-center text-sm text-gray-400">Loading product…</p>
        ) : error ? (
          <p className="text-center text-sm text-red-500">Couldn’t load product.</p>
        ) : !normalized ? (
          <p className="text-center text-sm text-gray-400">No product found.</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1.05fr,1.15fr] gap-6 items-start">
            {/* Left: photos */}
            <section className="flex gap-3 items-start justify-center lg:sticky lg:top-20">
              {/* Vertical thumbnails (md+) */}
              {normalized.photoUrls && normalized.photoUrls.length > 1 ? (
                <div className="hidden md:flex md:flex-col gap-2 md:max-h-[32rem] overflow-y-auto pr-1">
                  {normalized.photoUrls.map((u, idx) => (
                    <button
                      key={`thumb-${idx}`}
                      onClick={() => setActiveIdx(idx)}
                      className={`h-16 w-16 rounded-md overflow-hidden border bg-white dark:bg-gray-700 ${idx === activeIdx ? "border-blue-500 ring-2 ring-blue-200" : "border-gray-200 dark:border-gray-600"}`}
                    >
                      <img src={u} alt={`thumb-${idx}`} className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              ) : null}

              {/* Main image card (square) */}
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200/70 dark:border-gray-700 shadow-sm w-full max-w-[28rem] md:max-w-[32rem] aspect-square mx-auto overflow-hidden relative">
                {normalized.photoUrls && normalized.photoUrls.length ? (
                  <img
                    alt={normalized.title}
                    src={normalized.photoUrls[activeIdx]}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-gray-400 dark:text-gray-500">No image</div>
                )}
                {normalized.photoUrls && normalized.photoUrls.length > 1 ? (
                  <>
                    <button
                      onClick={() => hasPrev && setActiveIdx((i) => Math.max(0, i - 1))}
                      disabled={!hasPrev}
                      className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 dark:bg-gray-700/80 hover:bg-white dark:hover:bg-gray-700 text-gray-700 dark:text-gray-100 border border-gray-200 dark:border-gray-600 rounded-full h-9 w-9 flex items-center justify-center disabled:opacity-40"
                      aria-label="Previous image"
                    >
                      ‹
                    </button>
                    <button
                      onClick={() => hasNext && setActiveIdx((i) => Math.min((normalized.photoUrls?.length || 1) - 1, i + 1))}
                      disabled={!hasNext}
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 dark:bg-gray-700/80 hover:bg-white dark:hover:bg-gray-700 text-gray-700 dark:text-gray-100 border border-gray-200 dark:border-gray-600 rounded-full h-9 w-9 flex items-center justify-center disabled:opacity-40"
                      aria-label="Next image"
                    >
                      ›
                    </button>
                  </>
                ) : null}
              </div>

              {/* Horizontal thumbnails (sm) */}
              {normalized.photoUrls && normalized.photoUrls.length > 1 ? (
                <div className="md:hidden absolute -bottom-12 left-0 right-0 flex gap-2 justify-center">
                  {normalized.photoUrls.map((u, idx) => (
                    <button
                      key={`thumb-sm-${idx}`}
                      onClick={() => setActiveIdx(idx)}
                      className={`h-12 w-12 rounded-md overflow-hidden border bg-white dark:bg-gray-700 ${idx === activeIdx ? "border-blue-500 ring-2 ring-blue-200" : "border-gray-200 dark:border-gray-600"}`}
                    >
                      <img src={u} alt={`thumb-${idx}`} className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              ) : null}
            </section>

            {/* Right: details */}
            <section className="flex flex-col gap-4 min-w-0">
              {/* Title */}
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 leading-snug">{normalized.title}</h2>

              {/* Meta row */}
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-gray-600 dark:text-gray-300">Sold by</span>
                <span className="font-medium text-gray-800 dark:text-gray-100">{normalized.sellerName}</span>
                {normalized.tags && normalized.tags.length ? (
                  <span className="text-gray-300 dark:text-gray-600">|</span>
                ) : null}
                {normalized.tags && normalized.tags.length ? (
                  <div className="flex flex-wrap gap-1">
                    {normalized.tags.slice(0, 3).map((t, i) => (
                      <span key={`tag-top-${i}`} className="text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-full px-2 py-0.5">{String(t)}</span>
                    ))}
                  </div>
                ) : null}
              </div>

              {/* Buy box (Amazon-like, but with our palette and only Message Seller) */}
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200/70 dark:border-gray-700 shadow-sm p-4 w-full max-w-md">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-semibold text-gray-900 dark:text-gray-50">${normalized.price?.toFixed(2)}</span>
                  {normalized.priceNego ? (
                  <span className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5">Price Negotiable</span>
                  ) : null}
                  {normalized.trades ? (
                    <span className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">Open to trades</span>
                  ) : null}
                </div>
                <p className="text-sm text-emerald-700 mt-1">{normalized.sold ? 'Not available' : 'In Stock'}</p>
                <p className="text-xs text-gray-500 dark:text-gray-300">Pickup: {normalized.itemLocation || 'On campus'}</p>

                <div className="mt-3 space-y-2">
                  <button
                    onClick={() => navigate(`/app/chat${normalized.sellerId ? `?to=${encodeURIComponent(normalized.sellerId)}` : ''}`)}
                    disabled={!normalized.sellerId}
                    className="w-full rounded-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2"
                  >
                    Message Seller
                  </button>
                </div>
              </div>

              {/* Description */}
              {normalized.description ? (
                <div className="prose prose-sm max-w-none">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">About this item</h3>
                  <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line">{normalized.description}</p>
                </div>
              ) : null}

              {/* Detailed info (no duplicates with meta above) */}
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200/70 dark:border-gray-700 p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Detail label="Item location" value={normalized.itemLocation || '—'} />
                  <Detail label="Condition" value={normalized.itemCondition || '—'} />
                  <Detail label="Price Negotiable" value={normalized.priceNego ? 'Yes' : 'No'} />
                  <Detail label="Accepts trades" value={normalized.trades ? 'Yes' : 'No'} />
                  <Detail label="Seller email" value={normalized.sellerEmail ? (<a href={`mailto:${normalized.sellerEmail}`} className="text-blue-600 hover:underline">{normalized.sellerEmail}</a>) : '—'} />
                </div>
                <div className="space-y-2">
                  <Detail label="Date listed" value={normalized.dateListed ? formatDate(normalized.dateListed) : '—'} />
                  {normalized.sold ? (
                    <Detail label="Date sold" value={normalized.dateSold ? formatDate(normalized.dateSold) : '—'} />
                  ) : null}
                  {normalized.sold && normalized.finalPrice != null ? (
                    <Detail label="Final price" value={`$${Number(normalized.finalPrice).toFixed(2)}`} />
                  ) : null}
                </div>
              </div>

              <div className="pt-1">
                <button onClick={() => navigate(-1)} className="text-sm text-blue-600 dark:text-blue-300 hover:underline">Back to results</button>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500">{label}</span>
      <span className="text-sm text-gray-700 dark:text-gray-300">{value}</span>
    </div>
  );
}

function formatDate(d) {
  try {
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch (_) {
    return String(d);
  }
}
