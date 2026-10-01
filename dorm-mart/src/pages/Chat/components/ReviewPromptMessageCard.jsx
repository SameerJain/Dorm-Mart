import { useNavigate } from "react-router-dom";
import StatusPromptMessageCard, {
  usePromptStatus,
} from "./StatusPromptMessageCard";

function ReviewPromptMessageCard({ productId, productTitle }) {
  const navigate = useNavigate();
  const { isDone: hasReview, isLoading } = usePromptStatus({
    productId,
    statusUrl: "/reviews/get_review.php",
    resultKey: "has_review",
    logLabel: "Error fetching review status:",
  });

  const handleReviewClick = () => {
    if (productId) {
      navigate(`/app/purchase-history?review=${encodeURIComponent(productId)}`);
    }
  };

  if (isLoading) return null;

  const itemLabel = productTitle || "this item";

  return (
    <StatusPromptMessageCard
      isDone={hasReview}
      pendingIcon="star"
      pendingTitle="Next Steps: Leave a Review"
      doneTitle="Review Completed"
      pendingText={`Your purchase has been completed! Help other buyers by leaving a review for ${itemLabel}.`}
      doneText={`Thank you for leaving a review for ${itemLabel}! You can view or edit your review anytime.`}
      pendingButtonLabel="Leave a Review"
      doneButtonLabel="View Review"
      onAction={handleReviewClick}
    />
  );
}

export default ReviewPromptMessageCard;
