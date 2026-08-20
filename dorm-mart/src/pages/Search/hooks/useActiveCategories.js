import { useEffect, useState } from "react";
import { apiGetJson } from "../../../utils/apiClient";
import { API_BASE } from "../../../utils/apiConfig";

export function useActiveCategories() {
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    const controller = new AbortController();

    apiGetJson(`${API_BASE}/categories/get_active_categories.php`, {
      signal: controller.signal,
    })
      .then((data) => {
        if (!controller.signal.aborted && Array.isArray(data)) {
          setCategories(data);
        }
      })
      .catch(() => {});

    return () => controller.abort();
  }, []);

  return categories;
}
