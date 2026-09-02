import { useCallback, useEffect, useState } from "react";
import { API_BASE } from "../../../utils/apiConfig";
import { apiGetJson, csrfPostJson } from "../../../utils/apiClient";
import { loadScheduledPurchases } from "../utils/scheduledPurchaseUtils";

export function useScheduledPurchases() {
  const [buyerRequests, setBuyerRequests] = useState([]);
  const [sellerRequests, setSellerRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [busyRequestId, setBusyRequestId] = useState(0);

  const applyPurchases = useCallback((purchases) => {
    setBuyerRequests(purchases.buyerRequests);
    setSellerRequests(purchases.sellerRequests);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      applyPurchases(await loadScheduledPurchases());
    } catch {
      setError("Unable to refresh scheduled purchases.");
    } finally {
      setLoading(false);
    }
  }, [applyPurchases]);

  useEffect(() => {
    const abortController = new AbortController();
    async function load() {
      setLoading(true);
      setError("");
      try {
        applyPurchases(await loadScheduledPurchases(abortController.signal));
      } catch (e) {
        if (e.name !== "AbortError") {
          setError("Unable to load your scheduled purchases right now.");
        }
      } finally {
        setLoading(false);
      }
    }

    load();
    return () => abortController.abort();
  }, [applyPurchases]);

  const respondToRequest = useCallback(async (requestId, action) => {
    setBusyRequestId(requestId);
    setActionMessage("");
    setActionError("");
    try {
      const payload = await csrfPostJson(
        `${API_BASE}/scheduled_purchases/respond.php`,
        { request_id: requestId, action },
      );
      if (!payload?.success) {
        throw new Error(payload?.error || "Action failed");
      }

      const updated = payload.data || {};
      setBuyerRequests((prev) =>
        prev.map((req) => {
          if (req.request_id !== requestId) return req;
          return {
            ...req,
            status: updated.status || req.status,
            buyer_response_at:
              updated.buyer_response_at || new Date().toISOString(),
            meeting_at: updated.meeting_at || req.meeting_at,
            meet_location: updated.meet_location || req.meet_location,
            verification_code:
              updated.verification_code || req.verification_code,
            has_completed_confirm: req.has_completed_confirm,
          };
        }),
      );

      const sellerPayload = await apiGetJson(
        `${API_BASE}/scheduled_purchases/list_seller.php`,
      ).catch(() => null);
      if (sellerPayload?.success) {
        setSellerRequests(
          Array.isArray(sellerPayload.data) ? sellerPayload.data : [],
        );
      }

      setActionMessage(
        action === "accept"
          ? "Purchase accepted. Be sure to share the verification code when you meet."
          : "Purchase declined.",
      );
    } catch (e) {
      setActionError(e.message || "Something went wrong.");
    } finally {
      setBusyRequestId(0);
    }
  }, []);

  const cancelRequest = useCallback(
    async (requestId) => {
      setBusyRequestId(requestId);
      setActionError("");
      try {
        const payload = await csrfPostJson(
          `${API_BASE}/scheduled_purchases/cancel.php`,
          { request_id: requestId },
        );
        if (!payload?.success) {
          throw new Error(payload?.error || "Failed to cancel");
        }
        await refresh();
        setActionMessage("Purchase request cancelled successfully.");
        return true;
      } catch (e) {
        setActionError(e.message || "Something went wrong.");
        return false;
      } finally {
        setBusyRequestId(0);
      }
    },
    [refresh],
  );

  return {
    buyerRequests,
    sellerRequests,
    loading,
    error,
    actionMessage,
    actionError,
    busyRequestId,
    respondToRequest,
    cancelRequest,
  };
}
