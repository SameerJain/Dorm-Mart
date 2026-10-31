import FAQSectionList from "./FAQSectionList";

const SELLER_DASHBOARD_SECTIONS = [
  {
    title: "Managing listings",
    items: [
      {
        question: "How do I create a new listing?",
        answer: `Click "Create New Listing" in the blue Statistics section at the top of the dashboard.`,
      },
      {
        question: "How many photos and videos can I add?",
        answer: `Up to 6 in total, and at least one has to be a photo. Photos can be up to 2 MB and videos up to 25 MB.`,
      },
      {
        question: "How do I edit or delete a listing?",
        answer: `Use Edit or Delete next to the listing. These options aren't available while an accepted scheduled purchase is active, or after the item is sold.`,
      },
      {
        question: "Is deleting a listing permanent?",
        answer: `Yes. Once you delete a listing, you can't recover it.`,
      },
      {
        question: "How do I see my listing the way buyers see it?",
        answer: `Click the listing's title or image to open the page buyers see.`,
      },
    ],
  },
  {
    title: "Statistics",
    items: [
      {
        question: "What do the stats at the top show?",
        answer: `Active Listings counts published items, Pending Sales counts sales in progress, and Items Sold counts completed sales. The other stats show posts, views, wishlist saves, earnings, your seller rating, upcoming meetups, and average time to sell.`,
      },
    ],
  },
  {
    title: "Listing status",
    items: [
      {
        question: "What do the different statuses mean?",
        answer: `Active listings are visible to buyers. Drafts aren't published yet. Pending means a scheduled purchase is in progress. Sold means the sale is complete. Removed listings are off the marketplace.`,
      },
      {
        question: "How does the status change?",
        answer: `The app updates the status for you. A listing becomes Pending when a buyer accepts a scheduled purchase and Sold when the purchase is completed.`,
      },
      {
        question: "Why can't I edit or delete some listings?",
        answer: `Sold listings can't be edited or deleted. An accepted scheduled purchase also blocks these options while it's active. See the Chat and Purchases FAQs for help with scheduling or cancelling.`,
      },
    ],
  },
  {
    title: "Filtering and sorting",
    items: [
      {
        question: "How do I filter my listings?",
        answer: `Use the menus above your listings to filter by status or category, or sort by date and price. Select Sold to also sort by whether an item has a review.`,
      },
      {
        question: "A listing isn't showing up. What should I do?",
        answer: `Check the status and category filters first. If the listing is still missing, refresh the page and check that you're logged into the right account.`,
      },
    ],
  },
];

function SellerDashboardFAQ() {
  return <FAQSectionList sections={SELLER_DASHBOARD_SECTIONS} />;
}

export default SellerDashboardFAQ;
