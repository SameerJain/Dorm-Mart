import FAQItemList from "./FAQItemList";

const HOME_FAQ_ITEMS = [
  {
    question: 'What\'s the difference between "For You" and "Explore More"?',
    answer:
      '"For You" ranks listings based on the items you view, save, and buy, along with your interests. "Explore More" shows a random mix.',
  },
  {
    question: 'How does "For You" work for a new account?',
    answer:
      "You'll see popular and recent listings at first. The feed adjusts as you browse. You can also choose up to 3 interests in User Preferences under Settings.",
  },
  {
    question: "How do I open chat and notifications?",
    answer:
      "Use the chat and bell icons in the navigation bar.",
  },
  {
    question: "How do I open settings or my profile?",
    answer:
      "Open the menu in the navigation bar and choose Settings. To see your profile, choose My Profile in Settings.",
  },
  {
    question: "Why don't I see any personalized items?",
    answer:
      "A new account may not have enough browsing history yet, or there may be no listings that match your interests. Try browsing, saving items, or choosing interests in User Preferences.",
  },
  {
    question: "How do I contact a seller?",
    answer:
      'Open the listing and click "Message Seller" to start a chat.',
  },
  {
    question: 'What does "Price Negotiable" mean?',
    answer:
      "The seller is open to offers. Send them a message to discuss the price.",
  },
  {
    question: 'What does "Open to Trades" mean?',
    answer:
      "The seller may accept another item instead of money. Message them with what you'd like to trade.",
  },
  {
    question: "How do I report a listing?",
    answer:
      'Open the listing and click "Report". Pick a reason and add details if you need to. A moderator will review it.',
  },
];

function HomeFAQ() {
  return <FAQItemList items={HOME_FAQ_ITEMS} />;
}

export default HomeFAQ;
