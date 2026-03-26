import React from "react";

const CHAT_SECTIONS = [
  {
    title: "Getting Started",
    items: [
      {
        question: "How do I start a conversation?",
        answer: "Click \"Message Seller\" on any item's detail page. Only buyers can initiate conversations.",
      },
      {
        question: "Can I send images in chat?",
        answer: "Yes. Use the attachment icon next to the message input.",
      },
    ],
  },
  {
    title: "Scheduling & Confirming",
    items: [
      {
        question: "What is a Scheduled Purchase?",
        answer: "After agreeing on a deal, the seller sends a request with the meeting time, location, and final price. The buyer accepts to lock it in.",
      },
      {
        question: "What is Confirm Purchase?",
        answer: "After meeting in person, the seller sends a confirmation request. The buyer accepts after receiving the item and paying. Auto-confirms after 24 hours if ignored.",
      },
      {
        question: "What if I can't make it to a meeting?",
        answer: "Cancel from the Ongoing Purchases page and message the other person so they know.",
      },
    ],
  },
  {
    title: "Managing Chats",
    items: [
      {
        question: "What happens if I delete a chat?",
        answer: "It's removed on your side only. If there's an active scheduled purchase for that item, it gets automatically cancelled.",
      },
    ],
  },
];

function ChatFAQ() {
  return (
    <div className="space-y-5 text-sm text-gray-700 dark:text-gray-300">
      {CHAT_SECTIONS.map((section) => (
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

export default ChatFAQ;
