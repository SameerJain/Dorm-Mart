import React from "react";

const REVIEWS_FAQ_ITEMS = [
  {
    question: "How do I leave a review?",
    answer:
      "Go to Purchase History and click \"Leave a Review\" on the item. You can also use the link sent in chat after a purchase is confirmed.",
  },
  {
    question: "What ratings do I give?",
    answer:
      "You rate the seller (communication, reliability) and the product (accuracy, condition). Both use a 5-star scale.",
  },
  {
    question: "Can I edit or delete a review?",
    answer:
      "No. Reviews are final once submitted.",
  },
  {
    question: "When does the review option appear?",
    answer:
      "After the purchase is confirmed by the buyer, or auto-confirmed 24 hours after the seller's request.",
  },
  {
    question: "Can sellers rate buyers?",
    answer:
      "Yes. Sellers can rate buyers from the Seller Dashboard using the \"Rate Buyer\" button on sold items.",
  },
];

function ReviewsFAQ() {
  return (
    <div className="space-y-2.5 text-sm text-gray-700 dark:text-gray-300">
      {REVIEWS_FAQ_ITEMS.map((item, index) => (
        <div
          key={index}
          className="pb-2 border-b border-gray-200 dark:border-gray-700 last:border-b-0"
        >
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
            {item.question}
          </h3>
          <p className="mt-0.5">{item.answer}</p>
        </div>
      ))}
    </div>
  );
}

export default ReviewsFAQ;
