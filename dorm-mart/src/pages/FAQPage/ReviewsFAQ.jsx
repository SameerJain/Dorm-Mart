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
        answer: 'After the item is marked Sold, use "Rate Buyer" on that listing in your Seller Dashboard.',
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
  return (
    <div className="space-y-5 text-sm text-gray-700 dark:text-gray-300">
      {REVIEWS_SECTIONS.map((section) => (
        <section key={section.title} className="space-y-2.5">
          <h2 className="inline-block pl-2 pr-3 py-0.5 rounded-md bg-gray-100 dark:bg-gray-700 text-sm font-semibold tracking-wide uppercase text-gray-900 dark:text-gray-100">
            {section.title}
          </h2>
          {section.items.map((item) => (
            <div
              key={item.question}
              className="pb-2 border-b border-gray-200 dark:border-gray-700 last:border-b-0"
            >
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                {item.question}
              </h3>
              <p className="mt-0.5">{item.answer}</p>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

export default ReviewsFAQ;
