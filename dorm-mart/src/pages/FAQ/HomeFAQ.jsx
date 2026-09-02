const HOME_FAQ_ITEMS = [
  {
    question: 'What is the difference between "For You" and "Explore More"?',
    answer:
      '"For You" ranks listings using what you view, save, buy, and select as interests. "Explore More" shows a randomized mix.',
  },
  {
    question: 'How does "For You" work for a new account?',
    answer:
      "It starts with popular and recent listings, then adapts as you browse. You can also pick up to 3 interests in User Preferences.",
  },
  {
    question: "How do I access chat and notifications?",
    answer:
      "Use the chat and bell icons in the top-right corner of the navbar.",
  },
  {
    question: "How do I open settings or my profile?",
    answer:
      "Click your avatar or the menu icon in the navbar, then choose Settings or User Profile.",
  },
  {
    question: "Why don't I see any personalized items?",
    answer:
      'The feed may still be learning from a new account, or matching listings may be unavailable. Browse, save items, or add interests to improve it.',
  },
  {
    question: "How do I contact a seller?",
    answer:
      'Open the item detail page and click "Message Seller" to start a chat.',
  },
  {
    question: 'What does "Price Negotiable" mean?',
    answer:
      "The seller is open to offers. Message them to discuss a different price.",
  },
  {
    question: 'What does "Open to Trades" mean?',
    answer:
      "The seller may accept an item swap instead of cash. Reach out via chat to propose a trade.",
  },
];

function HomeFAQ() {
  return (
    <div className="space-y-2.5 text-sm text-gray-700 dark:text-gray-300">
      {HOME_FAQ_ITEMS.map((item, index) => (
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

export default HomeFAQ;
