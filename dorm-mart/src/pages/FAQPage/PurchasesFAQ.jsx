import React from "react";

const PURCHASES_SECTIONS = [
  {
    title: "Purchase History",
    items: [
      {
        question: "Where can I see my past purchases?",
        answer: "Open the navigation menu and go to \"Purchase History.\"",
      },
      {
        question: "How do I view a receipt?",
        answer: "Click \"See Receipt\" on any item in your purchase history.",
      },
      {
        question: "What do the Successful and Failed badges mean?",
        answer: "Successful means the trade completed. Failed means something went wrong such as a no-show or cancellation.",
      },
    ],
  },
  {
    title: "Ongoing Purchases",
    items: [
      {
        question: "Where are my scheduled purchases?",
        answer: "Go to Ongoing Purchases from the navigation menu to see active scheduled purchases.",
      },
      {
        question: "Can I cancel an ongoing purchase?",
        answer: "Yes. Open the purchase card and use the cancel option. Please message the other person to let them know.",
      },
    ],
  },
  {
    title: "Reviews",
    items: [
      {
        question: "What is the difference between \"Leave a Review\" and \"View Review\"?",
        answer: "\"Leave a Review\" appears when you haven't reviewed the item yet. After submitting it changes to \"View Review.\"",
      },
    ],
  },
];

function PurchasesFAQ() {
  return (
    <div className="space-y-5 text-sm text-gray-700 dark:text-gray-300">
      {PURCHASES_SECTIONS.map((section) => (
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

export default PurchasesFAQ;
