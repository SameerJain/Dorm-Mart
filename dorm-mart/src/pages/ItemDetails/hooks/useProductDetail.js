import { useEffect, useMemo, useState } from "react";
import { API_BASE, PUBLIC_BASE } from "../../../utils/apiConfig";
import { apiGetJson } from "../../../utils/apiClient";
import { normalizeProductDetail } from "../../../utils/productDetails";
import logger from "../../../utils/logger";

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
        const json = await apiGetJson(
          `${API_BASE}/product/view_product.php?product_id=${encodeURIComponent(productId)}`,
          { signal: controller.signal },
        );
        setData(json || null);
      } catch (error) {
        if (error.name !== "AbortError") {
          logger.error("view_product fetch failed:", error);
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
