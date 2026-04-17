import React from "react";

const SELLER_DASHBOARD_SECTIONS = [
  {
    title: "Managing Listings",
    items: [
      {
        question: "How do I create a new listing?",
        answer: `Click "Create New Listing" in the blue statistics strip at the top of the dashboard.`,
      },
      {
        question: "How do I edit or delete a listing?",
        answer: `Use the Edit or Delete buttons next to a listing. Editing and deleting are disabled while a scheduled purchase is active. Sold items cannot be deleted.`,
      },
      {
        question: "Is deleting a listing permanent?",
        answer: `Yes. Deleted listings are permanently removed and cannot be recovered.`,
      },
      {
        question: "How do I see my listing the way buyers see it?",
        answer: `Click the listing title or image to open the public product page.`,
      },
    ],
  },
  {
    title: "Statistics",
    items: [
      {
        question: "What do the stats at the top show?",
        answer: `Active Listings — items currently published. Pending Sales — sales in progress. Items Sold — your total completed sales.`,
      },
    ],
  },
  {
    title: "Listing Status",
    items: [
      {
        question: "What do the different statuses mean?",
        answer: `Active — visible to buyers. Pending — a scheduled purchase is in progress. Sold — item has been sold. Removed — taken off the marketplace.`,
      },
      {
        question: "How does the status change?",
        answer: `Status updates automatically. It becomes Pending when a buyer accepts a scheduled purchase, and Sold when the purchase is confirmed.`,
      },
      {
        question: "Why can't I edit or delete some listings?",
        answer: `Sold items can't be deleted. Items with an active scheduled purchase can't be edited or deleted until the purchase is completed or cancelled. For how scheduling works, see the Chat and Purchases FAQs.`,
      },
    ],
  },
  {
    title: "Filtering & Sorting",
    items: [
      {
        question: "How do I filter my listings?",
        answer: `Use the dropdown menus above the dashboard to filter by status or category, and to sort by date, price, or review status.`,
      },
      {
        question: "What sorting options are available?",
        answer: `Newest/Oldest First, Price Low-to-High or High-to-Low, and Reviewed Items On Top/Bottom (only when viewing Sold items).`,
      },
      {
        question: "A listing isn't showing up. What should I do?",
        answer: `Check your status and category filters, refresh the page, and make sure you're logged into the correct account.`,
      },
    ],
  },
];

function SellerDashboardFAQ() {
  return (
    <div className="space-y-5 text-sm text-gray-700 dark:text-gray-300">
      {SELLER_DASHBOARD_SECTIONS.map((section) => (
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
              <p className="mt-0.5 whitespace-pre-line">{item.answer}</p>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

export default SellerDashboardFAQ;
