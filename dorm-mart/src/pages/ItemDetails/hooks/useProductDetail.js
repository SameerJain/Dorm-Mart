import { useEffect, useMemo, useState } from "react";
import { API_BASE, PUBLIC_BASE } from "../../../utils/apiConfig";
import { normalizeProductDetail } from "../../../utils/productDetails";

export default function useProductDetail(productId) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!productId) return;

    const controller = new AbortController();
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(
          `${API_BASE}/product/view_product.php?product_id=${encodeURIComponent(productId)}`,
          {
            signal: controller.signal,
            credentials: "include",
          },
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const json = await response.json();
        setData(json || null);
      } catch (error) {
        if (error.name !== "AbortError") {
          console.error("view_product fetch failed:", error);
          setError(error);
        }
      } finally {
        setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [productId]);

  const normalized = useMemo(() => {
    return normalizeProductDetail(data, {
      apiBase: API_BASE,
      publicBase: PUBLIC_BASE,
    });
  }, [data]);

  return { loading, error, normalized };
}
