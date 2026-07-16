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
  return (
    <div className="space-y-2.5 text-sm text-gray-700 dark:text-gray-300">
      {NOTIFICATIONS_FAQ_ITEMS.map((item, index) => (
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

export default NotificationsFAQ;
