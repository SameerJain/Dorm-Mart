import { useState } from "react";
import { useNavigate } from "react-router-dom";
import HomeFAQ from "./HomeFAQ";
import ChatFAQ from "./ChatFAQ";
import SellerDashboardFAQ from "./SellerDashboardFAQ";
import PurchasesFAQ from "./PurchasesFAQ";
import ReviewsFAQ from "./ReviewsFAQ";
import SettingsFAQ from "./SettingsFAQ";
import BrowsingFAQ from "./BrowsingFAQ";

const TABS = [
  { id: "home", label: "Home" },
  { id: "browsing", label: "Browsing" },
  { id: "chat", label: "Chat" },
  { id: "purchases", label: "Purchases" },
  { id: "reviews", label: "Reviews" },
  { id: "seller", label: "Seller Dashboard" },
  { id: "settings", label: "Settings" },
];

const TAB_CONTENT = {
  home: <HomeFAQ />,
  browsing: <BrowsingFAQ />,
  chat: <ChatFAQ />,
  purchases: <PurchasesFAQ />,
  reviews: <ReviewsFAQ />,
  seller: <SellerDashboardFAQ />,
  settings: <SettingsFAQ />,
};

function FAQPage() {
  const [activeView, setActiveView] = useState("home");
  const navigate = useNavigate();

  const handleCloseFAQ = () => {
    navigate(-1);
  };

  return (
    <div className="w-full flex justify-center px-3 sm:px-4 py-4 sm:py-8">
      <div
        className="
          bg-white dark:bg-gray-800
          rounded-lg shadow-lg
          p-4 sm:p-5
          w-full max-w-7xl
          border-2 border-gray-300 dark:border-gray-600
          flex flex-col
        "
      >
        <style>
          {`
            .faq-content {
              font-size: 0.925rem;
            }
            @media (min-width: 768px) {
              .faq-content {
                font-size: 0.95rem;
              }
            }
          `}
        </style>

        {/* header */}
        <div className="flex items-center justify-between mb-4 sm:mb-5 gap-2">
          <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-gray-100">
            Frequently Asked Questions
          </h2>
          <button
            type="button"
            onClick={handleCloseFAQ}
            aria-label="Go back"
            className="
              text-gray-500 hover:text-gray-700
              dark:text-gray-400 dark:hover:text-gray-200
              text-sm sm:text-base leading-none
              px-2.5 sm:px-3 py-1.5
              border border-gray-300 dark:border-gray-600
              rounded-md
            "
          >
            &larr; Back
          </button>
        </div>

        {/* body */}
        <div className="flex flex-col md:flex-row gap-4 md:gap-6">
          {/* sidebar / mobile tabs */}
          <div
            className="
              flex gap-2 md:gap-2
              w-full md:w-44
              md:border-r border-gray-200 dark:border-gray-700
              md:pr-4
              flex-row md:flex-col
              flex-none
              overflow-x-auto md:overflow-visible
              pb-3 md:pb-0
              mb-2 md:mb-0
            "
          >
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveView(tab.id)}
                className={`
                  flex-1 md:flex-none
                  text-left px-3 sm:px-4 py-2 text-sm sm:text-base rounded-md border
                  whitespace-nowrap
                  ${
                    activeView === tab.id
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100 border-gray-300 dark:border-gray-600"
                  }
                `}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* content */}
          <div className="flex-1 mt-2 md:mt-0">
            <div className="faq-content px-1 sm:px-4 pt-3 sm:pt-4 pb-2">
              {TAB_CONTENT[activeView]}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FAQPage;
