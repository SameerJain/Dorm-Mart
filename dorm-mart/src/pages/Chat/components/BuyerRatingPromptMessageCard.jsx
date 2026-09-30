import { useNavigate } from "react-router-dom";
import StatusPromptMessageCard, {
  usePromptStatus,
} from "./StatusPromptMessageCard";

function BuyerRatingPromptMessageCard({ productId, productTitle, buyerId }) {
  const navigate = useNavigate();
  const { isDone: hasRating, isLoading } = usePromptStatus({
    productId,
    statusUrl: "/reviews/get_buyer_rating.php",
    resultKey: "has_rating",
    logLabel: "Error fetching buyer rating status:",
  });

  const handleRatingClick = () => {
    if (productId && buyerId) {
      navigate("/app/seller-dashboard", {
        state: { openBuyerRating: true, productId, productTitle, buyerId },
      });
    }
  };

  if (isLoading) return null;

  const itemLabel = productTitle || "this item";

  return (
    <StatusPromptMessageCard
      isDone={hasRating}
      pendingIcon="info"
      pendingTitle="Next Steps: Rate Buyer"
      doneTitle="Buyer Rated"
      pendingText={`Your purchase has been completed! Help other sellers by rating the buyer for ${itemLabel}.`}
      doneText={`Thank you for rating the buyer for ${itemLabel}! You can view or edit your rating anytime.`}
      pendingButtonLabel="Rate Buyer"
      doneButtonLabel="View Rating"
      onAction={handleRatingClick}
    />
  );
}

export default BuyerRatingPromptMessageCard;
