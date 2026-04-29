import { useEffect, useState } from "react";
import { API_BASE } from "../../../utils/apiConfig";

export default function useListingCategories() {
  const [availableCategories, setAvailableCategories] = useState([]);
  const [catFetchError, setCatFetchError] = useState(null);
  const [catLoading, setCatLoading] = useState(false);

  useEffect(() => {
    let ignore = false;
    async function loadCategories() {
      try {
        setCatLoading(true);
        setCatFetchError(null);
        const res = await fetch(`${API_BASE}/utility/get_categories.php`, {
          credentials: "include",
        });
        const text = await res.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch {
          throw new Error("Non-JSON response from get_categories.php");
        }
        if (!Array.isArray(data)) throw new Error("Expected array");
        if (!ignore) {
          setAvailableCategories(data.map(String));
        }
      } catch (e) {
        if (!ignore)
          setCatFetchError(e?.message || "Failed to load categories.");
      } finally {
        if (!ignore) setCatLoading(false);
      }
    }
    loadCategories();
    return () => {
      ignore = true;
    };
  }, []);

  return {
    availableCategories,
    catFetchError,
    catLoading,
  };
}
