import React from "react";

const HOME_FAQ_ITEMS = [
  {
    question: "What is the difference between \"For You\" and \"Explore More\"?",
    answer:
      "\"For You\" shows listings matching your interested categories. \"Explore More\" shows a randomized mix of everything.",
  },
  {
    question: "Why is the \"For You\" tab grayed out?",
    answer:
      "You haven't set interested categories yet. Go to Settings \u2192 User Preferences and pick up to 3.",
  },
  {
    question: "How do I list a new item?",
    answer:
      "Click \"List an item\" in the feed header, or use the navigation menu on mobile.",
  },
  {
    question: "How do I search for products?",
    answer:
      "Type a keyword into the search bar at the top and press Enter.",
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
      "You may not have set interested categories, or no listings match them yet. Try adding more or switch to \"Explore More.\"",
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
