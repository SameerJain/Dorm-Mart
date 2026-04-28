const BROWSING_SECTIONS = [
  {
    title: "Search & Filters",
    items: [
      {
        question: "How do I search for an item?",
        answer:
          "Type a keyword into the search bar at the top of any page and press Enter.",
      },
      {
        question: "What filters are available?",
        answer:
          "You can filter by category, price range, and item condition, and sort by date or price.",
      },
    ],
  },
  {
    title: "Wishlist",
    items: [
      {
        question: "How do I save an item?",
        answer:
          "Click the heart icon on any item card or detail page. It will appear in your wishlist.",
      },
      {
        question: "Where is my wishlist?",
        answer: 'Open the navigation menu and select "My Wishlist."',
      },
      {
        question:
          "I'm a seller: what does the wishlist count on my listing mean?",
        answer:
          "It shows how many users saved your item to their wishlist. The count is hidden once the item is sold.",
      },
    ],
  },
  {
    title: "Item Details",
    items: [
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
    ],
  },
];

function BrowsingFAQ() {
  return (
    <div className="space-y-5 text-sm text-gray-700 dark:text-gray-300">
      {BROWSING_SECTIONS.map((section) => (
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

export default BrowsingFAQ;
