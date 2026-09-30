import FAQItemList from "./FAQItemList";

const NOTIFICATIONS_FAQ_ITEMS = [
  {
    question: "What notifications does the app send?",
    answer:
      "You receive notifications for wishlist activity and new chat messages. No other notification types exist.",
  },
  {
    question: "Why does the red badge appear on the chat icon as well as the bell?",
    answer:
      "Chat message notifications show up on both the bell icon and the chat icon in the navbar, so you won't miss a message regardless of where you're looking.",
  },
  {
    question: "How do I mark a notification as read?",
    answer:
      "Click on the notification to open the related content. It is marked read automatically.",
  },
];

function NotificationsFAQ() {
  return <FAQItemList items={NOTIFICATIONS_FAQ_ITEMS} />;
}

export default NotificationsFAQ;
