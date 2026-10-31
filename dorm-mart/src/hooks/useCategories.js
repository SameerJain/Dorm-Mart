import { useEffect, useState } from "react";
import { API_BASE } from "../utils/apiConfig";
import { apiGetJson } from "../utils/apiClient";

// The full category list, used by the listing form and interest settings.
export default function useCategories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    apiGetJson(`${API_BASE}/categories/get_categories.php`, {
      signal: controller.signal,
    })
      .then((data) => {
        if (!Array.isArray(data)) throw new Error("Invalid categories format");
        setCategories(data.map(String));
      })
      .catch((e) => {
        if (e.name !== "AbortError") {
          setError(e.message || "Failed to load categories.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  return { categories, loading, error };
}
