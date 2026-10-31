import FAQItemList from "./FAQItemList";

const WISHLIST_FAQ_ITEMS = [
  {
    question: "How do I add an item to my wishlist?",
    answer:
      "Click the heart icon on a listing to save it to your wishlist. You'll need to be logged in.",
  },
  {
    question: "How do I remove an item from my wishlist?",
    answer:
      "Click the heart again on the item card or listing page. You can also use the remove button on your Wishlist page.",
  },
  {
    question: "Will wishlist items disappear if a listing is removed?",
    answer:
      "Yes. Your wishlist only shows active listings. Pending, sold, and removed items won't appear there, and you'll get a notification when one of your saved items changes.",
  },
  {
    question: "Is my wishlist visible to other users?",
    answer: "No. Only you can see your wishlist.",
  },
  {
    question: "What does the wishlist count on my listing mean?",
    answer:
      "It shows how many people have saved your item to their wishlist. The count still appears on sold listings.",
  },
];

function WishlistFAQ() {
  return <FAQItemList items={WISHLIST_FAQ_ITEMS} />;
}

export default WishlistFAQ;
