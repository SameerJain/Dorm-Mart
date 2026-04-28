import { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChatContext } from "../../../context/ChatContext";
import { API_BASE } from "../../../utils/apiConfig";

export default function useMessageSeller({
  productId,
  normalized,
  isSellerViewingOwnProduct,
  returnTo,
}) {
  const navigate = useNavigate();
  const chatCtx = useContext(ChatContext);
  const [msgLoading, setMsgLoading] = useState(false);
  const [msgError, setMsgError] = useState(null);

  useEffect(() => {
    setMsgLoading(false);
    setMsgError(null);
  }, [productId]);

  const handleMessageSeller = async () => {
    if (msgLoading || !normalized?.sellerId) return;

    if (isSellerViewingOwnProduct) {
      setMsgError("You are the seller of this item.");
      return;
    }

    setMsgError(null);
    setMsgLoading(true);

    try {
      const payload = {
        product_id: normalized?.productId ?? (productId ? Number(productId) : undefined),
        seller_user_id: normalized?.sellerId ?? undefined,
      };

      const response = await fetch(`${API_BASE}/chat/ensure_conversation.php`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) {
        const message = result?.error || `Failed to start chat (${response.status})`;
        throw new Error(message);
      }

      if (result.conversation && chatCtx?.registerConversation) {
        chatCtx.registerConversation(result.conversation);
      }

      const convId = result.conversation?.conv_id ?? result.conv_id ?? null;
      const navState = {
        convId,
        receiverId: normalized?.sellerId ?? null,
        receiverName: normalized?.sellerName ?? null,
        autoMessage: result.auto_message ?? null,
      };

      if (returnTo) {
        navigate(returnTo);
      } else {
        navigate("/app/chat", { state: navState });
      }
    } catch (error) {
      console.error("Message seller error", error);
      setMsgError(error?.message || "Unable to open chat.");
    } finally {
      setMsgLoading(false);
    }
  };

  return { msgLoading, msgError, handleMessageSeller };
}
