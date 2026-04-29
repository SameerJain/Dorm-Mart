import { useCallback, useEffect, useState } from "react";
import { API_BASE } from "../../../utils/apiConfig";

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
        const res = await fetch(
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
          console.error("Failed to check active scheduled purchase");
          setHasActiveScheduledPurchase(false);
          return;
        }
        const result = await res.json();
        setHasActiveScheduledPurchase(
          result.success ? result.has_active === true : false,
        );
      } catch (error) {
        if (error.name !== "AbortError") {
          console.error("Error checking active scheduled purchase:", error);
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
        const res = await fetch(`${API_BASE}/confirm_purchases/status.php`, {
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
    if (!activeConversation?.productId || !isSellerPerspective) return;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      checkActiveScheduledPurchase(controller.signal);
      checkConfirmStatus(controller.signal);
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
  ]);

  return {
    checkActiveScheduledPurchase,
    checkConfirmStatus,
    confirmStatus,
    hasActiveScheduledPurchase,
  };
}
