const WISHLIST_FAQ_ITEMS = [
  {
    question: "How do I add an item to my wishlist?",
    answer:
      "On any product listing, click the heart icon to save it to your wishlist. You must be logged in for this to work.",
  },
  {
    question: "How do I remove an item from my wishlist?",
    answer:
      "Click the heart icon again on the product card or listing page to toggle it off, or use the remove button directly on the Wishlist page.",
  },
  {
    question: "Will wishlist items disappear if a listing is removed?",
    answer:
      "Yes. If a seller deletes or closes a listing, it will no longer appear in your wishlist.",
  },
  {
    question: "Is my wishlist visible to other users?",
    answer: "No. Your wishlist is private and only visible to you.",
  },
  {
    question: "I'm a seller — what does the wishlist count on my listing mean?",
    answer:
      "It shows how many users have saved your item to their wishlist. The count is hidden once the item is sold.",
  },
];

function WishlistFAQ() {
  return (
    <div className="space-y-2.5 text-sm text-gray-700 dark:text-gray-300">
      {WISHLIST_FAQ_ITEMS.map((item, index) => (
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

export default WishlistFAQ;
