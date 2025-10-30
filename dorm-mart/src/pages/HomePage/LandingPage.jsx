// src/pages/HomePage/LandingPage.jsx
import React, { useEffect, useState, useMemo } from "react";
import ItemCardNew from "../../components/ItemCardNew";
import keyboard from "../../assets/product-images/keyboard.jpg";
import mouse from "../../assets/product-images/wireless-mouse.jpg";

const PUBLIC_BASE = (process.env.PUBLIC_URL || "").replace(/\/$/, "");
const API_BASE = (process.env.REACT_APP_API_BASE || `${PUBLIC_BASE}/api`).replace(/\/$/, "");
const carpetUrl = `${PUBLIC_BASE}/assets/product-images/smallcarpet.png`;

// local fallback data to show something if API is down
const FALLBACK_ITEMS = [
  {
    id: 1,
    title: "Wireless Keyboard",
    price: 40,
    img: keyboard,
    tags: ["Electronics", "Accessories"],
    seller: "Ava P.",
    rating: 4.8,
    location: "North Campus",
    status: "JUST POSTED",
    category: "Electronics",
  },
  {
    id: 2,
    title: "Small Carpet (5x7)",
    price: 25,
    img: carpetUrl,
    tags: ["Furniture", "Decor"],
    seller: "Mark D.",
    rating: 4.4,
    location: "Ellicott",
    status: "AVAILABLE",
    category: "Home & Dorm",
  },
  {
    id: 3,
    title: "Wireless Mouse",
    price: 30,
    img: mouse,
    tags: ["Electronics", "Accessories"],
    seller: "Sara T.",
    rating: 4.9,
    location: "South Campus",
    status: "PRICE DROP",
    category: "Electronics",
  },
];

export default function LandingPage() {
  const [user, setUser] = useState(null);
  const [interests, setInterests] = useState([]); // max 3
  const [allItems, setAllItems] = useState([]);
  const [loadingUser, setLoadingUser] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [errorUser, setErrorUser] = useState(false);
  const [errorItems, setErrorItems] = useState(false);

  // 1) fetch user -> get up to 3 interested categories
  useEffect(() => {
    const controller = new AbortController();

    async function loadUser() {
      try {
        setLoadingUser(true);
        const r = await fetch(`${API_BASE}/me.php`, {
          signal: controller.signal,
          credentials: "include",
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();

        // two possible shapes: array OR 3 separate columns
        let cats = [];
        if (Array.isArray(data?.interested_categories)) {
          cats = data.interested_categories.filter(Boolean).slice(0, 3);
        } else {
          const c1 = data?.interested_category_1 || null;
          const c2 = data?.interested_category_2 || null;
          const c3 = data?.interested_category_3 || null;
          cats = [c1, c2, c3].filter(Boolean);
        }

        setUser(data || null);
        setInterests(cats);
        setErrorUser(false);
      } catch (e) {
        if (e.name === "AbortError") return;
        console.error("me.php failed:", e);
        setErrorUser(true);
        setUser(null);
        setInterests([]); // no interests -> show general
      } finally {
        setLoadingUser(false);
      }
    }

    loadUser();
    return () => controller.abort();
  }, []);

  // 2) fetch items
  useEffect(() => {
    const controller = new AbortController();

    async function loadItems() {
      try {
        setLoadingItems(true);
        const r = await fetch(`${API_BASE}/landingListings.php`, {
          signal: controller.signal,
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();

        const normalized = (Array.isArray(data) ? data : []).map((d, i) => {
          const priceNum =
            typeof d.price === "number"
              ? d.price
              : parseFloat(`${d.price}`.replace(/[^0-9.]/g, "")) || 0;

          // DB stores "/data/images/filename.png"
          const rawImg = d.image || d.image_url || null;
          const img = rawImg
            ? `${API_BASE}/image.php?url=${encodeURIComponent(rawImg)}`
            : null;

          const createdAt = d.created_at ? new Date(d.created_at) : null;
          let status = d.status || null;
          if (!status && createdAt instanceof Date && !isNaN(createdAt)) {
            const hours = (Date.now() - createdAt.getTime()) / 36e5;
            status = hours < 48 ? "JUST POSTED" : "AVAILABLE";
          }

          const seller = d.seller || d.sold_by || d.seller_name || "Unknown Seller";
          const rating = typeof d.rating === "number" ? d.rating : 4.7;
          const location = d.location || d.campus || "North Campus";

          const tags = Array.isArray(d.tags)
            ? d.tags
            : typeof d.tags === "string"
              ? d.tags.split(",").map((t) => t.trim()).filter(Boolean)
              : [];

          // important: first tag acts as primary category if API didn't set one
          const category = d.category || (tags.length ? tags[0] : "General");

          return {
            id: d.id ?? i,
            title: d.title ?? "Untitled",
            price: priceNum,
            img,
            tags,
            seller,
            rating,
            location,
            status: status || "AVAILABLE",
            category,
          };
        });

        setAllItems(normalized.length ? normalized : FALLBACK_ITEMS);
        setErrorItems(false);
      } catch (e) {
        if (e.name === "AbortError") return;
        console.error("landingListings.php failed:", e);
        setErrorItems(true);
        setAllItems(FALLBACK_ITEMS);
      } finally {
        setLoadingItems(false);
      }
    }

    loadItems();
    return () => controller.abort();
  }, []);

  // 3) allocate items to interests WITHOUT duplicates
  const { itemsByInterest, exploreItems } = useMemo(() => {
    // no interests -> everything is explore
    if (!interests.length) {
      return {
        itemsByInterest: {},
        exploreItems: allItems,
      };
    }

    // prep buckets
    const byInterest = {};
    interests.forEach((c) => {
      byInterest[c] = [];
    });

    const used = new Set();

    // for each item, assign to FIRST matching interest only
    allItems.forEach((item) => {
      const itemCat = (item.category || "").toLowerCase();
      const itemTags = Array.isArray(item.tags)
        ? item.tags.map((t) => t.toLowerCase())
        : [];

      let placed = false;
      for (const ic of interests) {
        const icLower = ic.toLowerCase();
        const catMatch = itemCat === icLower;
        const tagMatch = itemTags.includes(icLower);

        if (catMatch || tagMatch) {
          byInterest[ic].push(item);
          used.add(item.id);
          placed = true;
          break; // <- FIRST match wins
        }
      }

      // if not placed, will go to explore later
    });

    // explore = those not used
    const explore = allItems.filter((it) => !used.has(it.id));

    return {
      itemsByInterest: byInterest,
      exploreItems: explore,
    };
  }, [allItems, interests]);

  const isLoading = loadingUser || loadingItems;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Top bar */}
      <div className="w-full px-4 md:px-10 py-4 border-b border-gray-200 dark:border-gray-800 bg-white/60 dark:bg-gray-900/60 backdrop-blur">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-blue-600 dark:text-blue-400 tracking-tight">
              Dorm Mart
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {user?.first_name
                ? `Hi ${user.first_name}, here’s what we found for you.`
                : "Browse items from UB students."}
            </p>
          </div>
          <div className="flex gap-2">
            {interests.length ? (
              interests.map((cat) => (
                <span
                  key={cat}
                  className="inline-flex items-center rounded-full bg-blue-50 dark:bg-blue-950/50 px-3 py-1 text-xs font-medium text-blue-700 dark:text-blue-200 border border-blue-200/50 dark:border-blue-700/30"
                >
                  {cat}
                </span>
              ))
            ) : (
              <span className="text-xs text-gray-400 dark:text-gray-500 italic">
                No interests set — showing general items
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="w-full max-w-6xl mx-auto flex-1 px-4 md:px-10 py-6 flex flex-col gap-10">
        {/* For you */}
        {interests.length ? (
          <section className="space-y-6">
            <header className="flex items-center justify-between">
              <div>
                <h2 className="text-lg md:text-xl font-semibold text-blue-600 dark:text-blue-400">
                  For you
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Based on your categories
                </p>
              </div>
            </header>

            <div className="space-y-8">
              {interests.map((cat) => {
                const catItems = itemsByInterest[cat] || [];
                return (
                  <div key={cat} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                        {cat}
                      </h3>
                      <button
                        type="button"
                        className="text-xs text-blue-600 dark:text-blue-300 hover:underline"
                      >
                        View all
                      </button>
                    </div>
                    <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-blue-200 dark:scrollbar-thumb-blue-900/50">
                      {catItems.length ? (
                        catItems.map((item) => (
                          <div
                            key={item.id}
                            className="min-w-[210px] max-w-[210px] flex-shrink-0"
                          >
                            <ItemCardNew
                              title={item.title}
                              price={
                                typeof item.price === "number"
                                  ? `$${item.price.toFixed(2)}`
                                  : item.price || "$0.00"
                              }
                              seller={item.seller}
                              rating={item.rating}
                              location={item.location}
                              tags={Array.isArray(item.tags) ? item.tags : []}
                              status={item.status}
                              image={item.img || undefined}
                            />
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-gray-400 dark:text-gray-500 italic">
                          No items in this category yet.
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        {/* Explore / general */}
        <section className="space-y-4">
          <header className="flex items-center justify-between">
            <div>
              <h2 className="text-lg md:text-xl font-semibold text-blue-600 dark:text-blue-400">
                {interests.length ? "Explore more" : "Recommended for you"}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {interests.length
                  ? "Not in your categories — still worth a look."
                  : "Popular items from UB students."}
              </p>
            </div>
            <button
              type="button"
              className="text-xs text-blue-600 dark:text-blue-200 hover:underline"
            >
              See all listings
            </button>
          </header>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {exploreItems.map((item, idx) => (
              <ItemCardNew
                key={item.id || idx}
                title={item.title}
                price={
                  typeof item.price === "number"
                    ? `$${item.price.toFixed(2)}`
                    : item.price || "$0.00"
                }
                seller={item.seller}
                rating={item.rating}
                location={item.location}
                tags={Array.isArray(item.tags) ? item.tags : []}
                status={item.status}
                image={item.img || undefined}
              />
            ))}
          </div>
        </section>

        {/* Status messages */}
        {isLoading && (
          <p className="text-center text-gray-500 dark:text-gray-400 italic pb-4">
            Loading your feed…
          </p>
        )}
        {errorUser && (
          <p className="text-center text-red-600 dark:text-red-400 italic pb-4">
            Couldn’t load your preferences — showing general items.
          </p>
        )}
        {errorItems && (
          <p className="text-center text-red-600 dark:text-red-400 italic pb-4">
            Couldn’t load latest listings. Showing sample items.
          </p>
        )}
      </div>
    </div>
  );
}
