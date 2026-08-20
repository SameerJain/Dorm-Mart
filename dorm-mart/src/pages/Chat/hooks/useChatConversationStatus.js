import { useCallback, useEffect, useState } from "react";
import { API_BASE } from "../../../utils/apiConfig";
import { csrfFetch } from "../../../utils/csrfFetch";
import logger from "../../../utils/logger";

export default function useChatConversationStatus({
  activeConvId,
  activeConversation,
  isSellerPerspective,
  messagesLength,
  myId,
}) {
  const [hasActiveScheduledPurchase, setHasActiveScheduledPurchase] =
    useState(false);
  const [confirmStatus, setConfirmStatus] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState(null);

  const checkActiveScheduledPurchase = useCallback(
    async (signal) => {
      const productId = activeConversation?.productId;
      const sellerView =
        activeConversation?.productId &&
        activeConversation?.productSellerId &&
        myId &&
        Number(activeConversation.productSellerId) === Number(myId);
      if (!productId || !sellerView) {
        setHasActiveScheduledPurchase(false);
        return;
      }
      try {
        const res = await csrfFetch(
          `${API_BASE}/scheduled_purchases/check_active.php`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            credentials: "include",
            signal,
            body: JSON.stringify({ product_id: productId }),
          },
        );
        if (!res.ok) {
          logger.error("Failed to check active scheduled purchase");
          setHasActiveScheduledPurchase(false);
          return;
        }
        const result = await res.json();
        setHasActiveScheduledPurchase(
          result.success ? result.has_active === true : false,
        );
      } catch (error) {
        if (error.name !== "AbortError") {
          logger.error("Error checking active scheduled purchase:", error);
          setHasActiveScheduledPurchase(false);
        }
      }
    },
    [activeConversation?.productId, activeConversation?.productSellerId, myId],
  );

  const checkConfirmStatus = useCallback(
    async (signal) => {
      if (
        !activeConvId ||
        !activeConversation?.productId ||
        !isSellerPerspective
      ) {
        setConfirmStatus(null);
        return;
      }
      try {
        const res = await csrfFetch(`${API_BASE}/confirm_purchases/status.php`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          credentials: "include",
          signal,
          body: JSON.stringify({
            conversation_id: activeConvId,
            product_id: activeConversation.productId,
          }),
        });
        if (!res.ok) throw new Error("Failed to load confirm status");
        const result = await res.json();
        if (result.success) {
          const data = result.data || {};
          if (typeof data.can_confirm !== "boolean") data.can_confirm = false;
          if (!data.can_confirm && !data.message) {
            if (data.reason_code === "pending_request")
              data.message =
                "Waiting for the buyer to respond to your confirmation.";
            else if (data.reason_code === "missing_schedule")
              data.message =
                "Create and get a Schedule Purchase accepted before confirming.";
            else if (data.reason_code === "already_confirmed")
              data.message = "This purchase has already been confirmed.";
            else data.message = "Confirm Purchase is not available right now.";
          }
          setConfirmStatus(data);
        } else {
          setConfirmStatus({
            can_confirm: false,
            message: result.error || "Unable to check Confirm Purchase status.",
          });
        }
      } catch (error) {
        if (error.name !== "AbortError") {
          setConfirmStatus({
            can_confirm: false,
            message: "Unable to check Confirm Purchase status.",
          });
        }
      }
    },
    [activeConvId, activeConversation?.productId, isSellerPerspective],
  );

  const checkPaymentStatus = useCallback(
    async (signal) => {
      if (!activeConvId || !activeConversation?.productId) {
        setPaymentStatus(null);
        return;
      }
      try {
        const res = await csrfFetch(`${API_BASE}/payments/status.php`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          credentials: "include",
          signal,
          body: JSON.stringify({
            conversation_id: activeConvId,
            product_id: activeConversation.productId,
          }),
        });
        if (!res.ok) throw new Error("Failed to load payment status");
        const result = await res.json();
        setPaymentStatus(result.success ? result.data || null : null);
      } catch (error) {
        if (error.name !== "AbortError") logger.error("Error checking payment status:", error);
      }
    },
    [activeConvId, activeConversation?.productId],
  );

  useEffect(() => {
    const controller = new AbortController();
    checkActiveScheduledPurchase(controller.signal);
    return () => controller.abort();
  }, [checkActiveScheduledPurchase]);

  useEffect(() => {
    const controller = new AbortController();
    checkConfirmStatus(controller.signal);
    return () => controller.abort();
  }, [checkConfirmStatus]);

  useEffect(() => {
    const controller = new AbortController();
    checkPaymentStatus(controller.signal);
    return () => controller.abort();
  }, [checkPaymentStatus]);

  useEffect(() => {
    if (!paymentStatus?.available || paymentStatus.completed) return undefined;
    const controller = new AbortController();
    const boundaries = [paymentStatus.window_starts_at, paymentStatus.window_ends_at]
      .map((value) => new Date(value).getTime() - Date.now())
      .filter((delay) => Number.isFinite(delay) && delay > 0);
    const boundaryTimer = boundaries.length
      ? setTimeout(() => checkPaymentStatus(controller.signal), Math.min(...boundaries) + 100)
      : null;
    const pollTimer = setInterval(() => checkPaymentStatus(controller.signal), 15000);
    return () => {
      if (boundaryTimer) clearTimeout(boundaryTimer);
      clearInterval(pollTimer);
      controller.abort();
    };
  }, [checkPaymentStatus, paymentStatus?.available, paymentStatus?.completed, paymentStatus?.window_ends_at, paymentStatus?.window_starts_at]);

  useEffect(() => {
    if (!activeConversation?.productId || !isSellerPerspective) return;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      checkActiveScheduledPurchase(controller.signal);
      checkConfirmStatus(controller.signal);
      checkPaymentStatus(controller.signal);
    }, 500);
    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [
    messagesLength,
    activeConversation?.productId,
    isSellerPerspective,
    checkActiveScheduledPurchase,
    checkConfirmStatus,
    checkPaymentStatus,
  ]);

  return {
    checkActiveScheduledPurchase,
    checkConfirmStatus,
    checkPaymentStatus,
    confirmStatus,
    hasActiveScheduledPurchase,
    paymentStatus,
  };
}
