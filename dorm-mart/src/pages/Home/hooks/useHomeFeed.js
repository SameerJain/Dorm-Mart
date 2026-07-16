import { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../../../utils/apiConfig";
import { apiGetJson } from "../../../utils/apiClient";
import logger from "../../../utils/logger";
import {
  FALLBACK_ITEMS,
  buildHomeFeed,
  computeExploreLimit,
  getQuickFilterCategories,
  normalizeLandingItem,
  readStoredFeedTab,
  writeStoredFeedTab,
} from "../utils/homeFeedUtils";

export function useHomeFeed() {
  const [interests, setInterests] = useState([]);
  const [allItems, setAllItems] = useState([]);
  const [allCategories, setAllCategories] = useState([]);
  const [wishlistedIds, setWishlistedIds] = useState(new Set());
  const [loadingUser, setLoadingUser] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  const [errorUser, setErrorUser] = useState(false);
  const [errorItems, setErrorItems] = useState(false);
  const [activeTab, setActiveTab] = useState("forYou");
  const [exploreLimit, setExploreLimit] = useState(computeExploreLimit);

  useEffect(() => {
    const controller = new AbortController();
    async function loadUser() {
      try {
        setLoadingUser(true);
        const data = await apiGetJson(`${API_BASE}/user/me.php`, {
          signal: controller.signal,
        });
        const categories = Array.isArray(data?.interested_categories)
          ? data.interested_categories.filter(Boolean).slice(0, 3)
          : [
              data?.interested_category_1,
              data?.interested_category_2,
              data?.interested_category_3,
            ].filter(Boolean);
        setInterests(categories);
        setErrorUser(false);
      } catch (error) {
        if (error.name !== "AbortError") {
          logger.error("me.php failed:", error);
          setInterests([]);
          setErrorUser(true);
        }
      } finally {
        setLoadingUser(false);
      }
    }

    loadUser();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (loadingUser) return;
    if (!interests.length) {
      setActiveTab("explore");
      writeStoredFeedTab("explore");
      return;
    }
    const stored = readStoredFeedTab();
    if (stored === "explore" || stored === "forYou") {
      setActiveTab(stored);
    }
  }, [loadingUser, interests.length]);

  useEffect(() => {
    const handler = () => setExploreLimit(computeExploreLimit());
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    async function loadItems() {
      try {
        setLoadingItems(true);
        const data = await apiGetJson(`${API_BASE}/listings/landing_listings.php`, {
          signal: controller.signal,
        });
        const normalized = (Array.isArray(data) ? data : []).map(
          normalizeLandingItem,
        );
        setAllItems(normalized.length ? normalized : FALLBACK_ITEMS);
        setErrorItems(false);
      } catch (error) {
        if (error.name !== "AbortError") {
          logger.error("listings/landing_listings.php failed:", error);
          setErrorItems(true);
          setAllItems(FALLBACK_ITEMS);
        }
      } finally {
        setLoadingItems(false);
      }
    }

    loadItems();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    async function loadCategories() {
      try {
        const data = await apiGetJson(`${API_BASE}/categories/get_active_categories.php`, {
          signal: controller.signal,
          credentials: "same-origin",
        });
        if (Array.isArray(data)) setAllCategories(data);
      } catch {
        /* optional */
      }
    }

    loadCategories();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    async function loadWishlist() {
      try {
        const json = await apiGetJson(`${API_BASE}/wishlist/get_wishlist.php`, {
          signal: controller.signal,
        });
        if (json?.success && Array.isArray(json.data)) {
          setWishlistedIds(new Set(json.data.map((item) => item.product_id)));
        }
      } catch {
        /* optional */
      }
    }

    loadWishlist();
    return () => controller.abort();
  }, []);

  const feed = useMemo(
    () => buildHomeFeed(allItems, interests, exploreLimit),
    [allItems, exploreLimit, interests],
  );
  const quickFilterCategories = useMemo(
    () => getQuickFilterCategories(allCategories, allItems),
    [allCategories, allItems],
  );

  const selectTab = (tab) => {
    setActiveTab(tab);
    writeStoredFeedTab(tab);
  };

  return {
    activeTab,
    errorItems,
    errorUser,
    interests,
    isLoading: loadingUser || loadingItems,
    loadingUser,
    itemsByInterest: feed.itemsByInterest,
    exploreItems: feed.exploreItems,
    quickFilterCategories,
    selectTab,
    wishlistedIds,
  };
}
