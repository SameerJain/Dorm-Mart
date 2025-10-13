// src/pages/HomePage/LandingPage.jsx
import React, { useEffect, useState } from "react";
import ItemCardNew from "../../components/ItemCardNew";
import keyboard from "../../assets/product-images/keyboard.jpg";
import mouse from "../../assets/product-images/wireless-mouse.jpg";
import puppy from "../../assets/icons/puppy.jpg";

const PUBLIC_BASE = (process.env.PUBLIC_URL || '').replace(/\/$/, '');
// Expect the file at: public/assets/product-images/smallcarpet.png
const carpetUrl = `${PUBLIC_BASE}/assets/product-images/smallcarpet.png`;

// local fallback data to show something if API is down
const FALLBACK_ITEMS = [
  { id: 1, title: "Wireless Keyboard", price: 40, img: keyboard, tags: ["Electronics", "Accessories"], seller: "Ava P.", rating: 4.8, location: "North Campus", status: "JUST POSTED" },
  { id: 2, title: "Small Carpet (5x7)", price: 25, img: carpetUrl, tags: ["Furniture", "Decor"], seller: "Mark D.", rating: 4.4, location: "Ellicott", status: "AVAILABLE" },
  { id: 3, title: "Wireless Mouse", price: 30, img: mouse, tags: ["Electronics", "Accessories"], seller: "Sara T.", rating: 4.9, location: "South Campus", status: "PRICE DROP" },
];

export default function LandingPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        setLoading(true);
        const PUBLIC = (process.env.PUBLIC_URL || '').replace(/\/$/, '');
        const BASE = process.env.REACT_APP_API_BASE || `${PUBLIC}/api`;
        const r = await fetch(`${BASE}/landingListings.php`, { signal: controller.signal });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        // normalize data to our card props shape
        const normalized = (Array.isArray(data) ? data : []).map((d, i) => {
          const priceNum = typeof d.price === 'number' ? d.price : parseFloat(`${d.price}`.replace(/[^0-9.]/g, '')) || 0;
          const img = d.image || d.image_url || null;
          const createdAt = d.created_at ? new Date(d.created_at) : null;
          let status = d.status || null;
          if (!status && createdAt instanceof Date && !isNaN(createdAt)) {
            const hours = (Date.now() - createdAt.getTime()) / 36e5;
            status = hours < 48 ? 'JUST POSTED' : 'AVAILABLE';
          }
          const seller = d.seller || d.sold_by || d.seller_name || 'Unknown Seller';
          const rating = typeof d.rating === 'number' ? d.rating : 4.7;
          const location = d.location || d.campus || 'North Campus';
          const tags = Array.isArray(d.tags)
            ? d.tags
            : (typeof d.tags === 'string' ? d.tags.split(',').map(t => t.trim()).filter(Boolean) : []);
          return {
            id: d.id ?? i,
            title: d.title ?? 'Untitled',
            price: priceNum,
            img,
            tags,
            seller,
            rating,
            location,
            status: status || 'AVAILABLE',
          };
        });
        setItems(normalized.length ? normalized : FALLBACK_ITEMS);
        setError(false);
      } catch (e) {
        if (e.name === 'AbortError') return;
        console.error(e);
        setError(true);
        setItems(FALLBACK_ITEMS);
      } finally {
        setLoading(false);
      }
    }
    load();
    return () => controller.abort();
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero Section (responsive, dynamic height) */}
      <section className="mt-4 px-4">
        <div className="mx-auto w-full max-w-6xl rounded-2xl bg-blue-600 px-6 py-8 md:px-10 md:py-10 text-center flex flex-col items-center justify-center">
          <h1 className="mb-3 text-white font-bold text-4xl sm:text-5xl md:text-6xl leading-tight">
            Welcome to Dorm Mart
          </h1>
          <p className="text-slate-100 font-semibold text-lg sm:text-2xl md:text-3xl max-w-prose">
            Find what you need
          </p>
        </div>
      </section>

      {/* Browse Listings Title */}
      <div className="w-full mt-8 px-6 md:px-16">
        <div className="flex items-end justify-between flex-wrap gap-3 mb-3">
          <h2
            style={{
              fontFamily: 'Tai Heritage Pro, serif',
              fontSize: "28px",
              fontWeight: 700,
              fontStyle: "normal",
              lineHeight: "normal",
              letterSpacing: "0.5px"
            }}
            className="text-left text-blue-600"
          >
            Browse Listings
          </h2>
        </div>
      </div>

      {/* Featured Items */}
      <section id="shop" className="py-16 px-6 md:px-16 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
            {items.map((item, idx) => (
              <ItemCardNew
                key={item.id || idx}
                title={item.title}
                price={typeof item.price === 'number' ? `$${item.price.toFixed(2)}` : (item.price || '$0.00')}
                seller={item.seller}
                rating={item.rating}
                location={item.location}
                tags={Array.isArray(item.tags) ? item.tags : []}
                status={item.status}
                image={item.img || undefined}
              />
            ))}
          </div>
        </div>
      </section>
      {loading && (
        <p className="text-center text-gray-500 italic pb-8">Loading listings…</p>
      )}
      {error && (
        <p className="text-center text-red-600 italic pb-8">Couldn’t load latest listings. Showing sample items.</p>
      )}
    </div>
  );
}
