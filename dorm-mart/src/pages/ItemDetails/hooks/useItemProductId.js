import { useMemo } from "react";
import { useLocation, useParams } from "react-router-dom";

export default function useItemProductId() {
  const { search } = useLocation();
  const params = useParams();

  return useMemo(() => {
    const query = new URLSearchParams(search);
    const productIdFromParams = params.product_id || params.id || null;
    const productIdFromQuery = query.get("product_id") || query.get("id");
    return productIdFromParams || productIdFromQuery || null;
  }, [params.id, params.product_id, search]);
}
