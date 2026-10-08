import FAQSectionList from "./FAQSectionList";

const REVIEWS_SECTIONS = [
  {
    title: "Buyers",
    items: [
      {
        question: "How do I leave a review?",
        answer:
          'Find the item in Purchase History and click "Leave a Review". You can also use the review link in chat after the purchase is completed.',
      },
      {
        question: "What do I rate?",
        answer:
          "You'll give separate ratings for the seller and the item, each out of 5 stars. Think about the seller's communication and reliability, and whether the item matched its description and condition.",
      },
      {
        question: "Can I edit or delete a review?",
        answer: "No. Once you submit a review, you can't edit or delete it.",
      },
      {
        question: "When does the review option appear?",
        answer:
          "You can leave a review once the purchase is completed. This happens when the buyer accepts the seller's confirmation request, or when 24 hours pass without a response and the app accepts it.",
      },
    ],
  },
  {
    title: "Sellers",
    items: [
      {
        question: "When can I rate a buyer?",
        answer:
          'Once the item is marked Sold, click "Rate Buyer" on the listing in your Seller Dashboard or on the prompt in chat.',
      },
      {
        question: "What are seller and product ratings?",
        answer:
          "The seller rating is the buyer's rating of you. The product rating is their rating of the item. You'll see both as stars on sold listings once the buyer leaves a review.",
      },
    ],
  },
];

function ReviewsFAQ() {
  return <FAQSectionList sections={REVIEWS_SECTIONS} />;
}

export default ReviewsFAQ;
