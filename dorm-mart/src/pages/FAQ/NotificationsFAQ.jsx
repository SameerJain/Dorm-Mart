import FAQItemList from "./FAQItemList";

const NOTIFICATIONS_FAQ_ITEMS = [
  {
    question: "What notifications does the app send?",
    answer:
      "You'll get wishlist updates, scheduled purchase updates, review notifications, reminders, and updates on reports. You'll also hear about it when your account signs in from a new device. Unread chat messages have a separate badge on the chat icon.",
  },
  {
    question: "What do the red badges on the chat and bell icons mean?",
    answer:
      "The chat badge counts unread messages. The bell badge counts unread notifications. They track different things, so the numbers can differ.",
  },
  {
    question: "How do I mark a notification as read?",
    answer:
      'Click a notification to mark it as read and open any linked page. You can also click "Mark all read" to mark them all at once.',
  },
];

function NotificationsFAQ() {
  return <FAQItemList items={NOTIFICATIONS_FAQ_ITEMS} />;
}

export default NotificationsFAQ;
