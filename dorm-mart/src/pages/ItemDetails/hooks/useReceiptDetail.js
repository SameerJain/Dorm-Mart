import { useEffect, useMemo, useState } from "react";
import { API_BASE, PUBLIC_BASE } from "../../../utils/apiConfig";
import { normalizeProductDetail } from "../../../utils/productDetails";

function getReceiptPayloads(payload) {
  const productPayload =
    payload?.product ?? payload?.product_details ?? payload?.item ?? payload;
  const receiptPayload =
    payload?.receipt ??
    payload?.receipt_details ??
    payload?.purchase ??
    payload?.purchase_details ??
    payload?.confirmation ??
    payload?.confirm ??
    payload;

  return {
    productData: productPayload || null,
    receiptData: receiptPayload || null,
  };
}

async function readReceiptError(response) {
  let errorMessage = `HTTP ${response.status}`;

  try {
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      const errorJson = await response.json();
      console.error("[ViewReceipt] API error response:", errorJson);
      return errorJson?.error || errorJson?.message || errorMessage;
    }

    const text = await response.text();
    console.error("[ViewReceipt] Non-JSON error response:", text);
    if (text) {
      errorMessage = text.substring(0, 200);
    }
  } catch (parseError) {
    console.error("[ViewReceipt] Failed to parse error response:", parseError);
  }

  return errorMessage;
}

export default function useReceiptDetail(productId) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [productData, setProductData] = useState(null);
  const [receiptData, setReceiptData] = useState(null);

  useEffect(() => {
    if (!productId) return;

    const controller = new AbortController();
    (async () => {
      try {
        setLoading(true);
        setError(null);

        const queryParams = new URLSearchParams();
        queryParams.set("product_id", productId);
        queryParams.set("id", productId);

        const response = await fetch(
          `${API_BASE}/receipt/view_receipt.php?${queryParams.toString()}`,
          {
            signal: controller.signal,
            credentials: "include",
          },
        );

        if (!response.ok) {
          throw new Error(await readReceiptError(response));
        }

        const json = await response.json();
        if (!json.success && json.error) {
          throw new Error(json.error);
        }

        const payload = json?.data ?? json ?? null;
        const nextPayloads = getReceiptPayloads(payload);
        setProductData(nextPayloads.productData);
        setReceiptData(nextPayloads.receiptData);
      } catch (error) {
        if (error.name !== "AbortError") {
          console.error("viewReceipt fetch failed:", error);
          setError(error);
        }
      } finally {
        setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [productId]);

  const normalized = useMemo(() => {
    return normalizeProductDetail(productData, {
      apiBase: API_BASE,
      publicBase: PUBLIC_BASE,
    });
  }, [productData]);

  return { loading, error, receiptData, normalized };
}
