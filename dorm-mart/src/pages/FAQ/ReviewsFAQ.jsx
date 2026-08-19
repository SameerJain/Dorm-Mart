import FAQSectionList from "./FAQSectionList";

const REVIEWS_SECTIONS = [
  {
    title: "Buyers",
    items: [
      {
        question: "How do I leave a review?",
        answer:
          'Go to Purchase History and click "Leave a Review" on the item. You can also use the link sent in chat after a purchase is confirmed.',
      },
      {
        question: "What ratings do I give?",
        answer:
          "You rate the seller (communication, reliability) and the product (accuracy, condition). Both use a 5-star scale.",
      },
      {
        question: "Can I edit or delete a review?",
        answer: "No. Reviews are final once submitted.",
      },
      {
        question: "When does the review option appear?",
        answer:
          "After the purchase is confirmed by the buyer, or auto-confirmed 24 hours after the seller's request.",
      },
    ],
  },
  {
    title: "Sellers",
    items: [
      {
        question: "When can I rate a buyer?",
        answer:
          'After the item is marked Sold, use "Rate Buyer" on that listing in your Seller Dashboard.',
      },
      {
        question: "What are seller and product ratings?",
        answer:
          "The seller rating is how the buyer rated you. The product rating is how they rated the item. Both show as stars on sold listings that have reviews.",
      },
      {
        question: "Can sellers rate buyers?",
        answer:
          'Yes. From the Seller Dashboard, use "Rate Buyer" on sold items once the sale is complete.',
      },
    ],
  },
];

function ReviewsFAQ() {
  return <FAQSectionList sections={REVIEWS_SECTIONS} />;
}

export default ReviewsFAQ;
