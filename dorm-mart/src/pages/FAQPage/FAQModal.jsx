import React, { useState, useEffect } from "react";
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

function FAQModal({ isOpen, onClose }) {
  const [activeView, setActiveView] = useState("home");
  const navigate = useNavigate();

  useEffect(() => {
    if (!isOpen) return;
    const prevBody = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflow = prevHtml;
    };
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleOpenFaqsPage = () => {
    onClose?.();
    navigate("/app/faq");
  };

  return (
    <div
      className="
        fixed inset-0 z-50
        flex items-center justify-center
        overscroll-none
      "
      onClick={onClose}
    >
      <div
        className="
          bg-white dark:bg-gray-800
          rounded-lg shadow-lg
          p-5
          w-full max-w-6xl
          h-[70vh]
          border-2 border-gray-300 dark:border-gray-600
          flex flex-col
        "
        onClick={(e) => e.stopPropagation()}
      >
        <style>
          {`
            .faq-content {
              font-size: 0.95rem;
            }
          `}
        </style>

        {/* header */}
        <div className="flex items-center justify-between mb-5 flex-none">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            Frequently Asked Questions
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close QnA modal"
            className="
              text-gray-500 hover:text-gray-700
              dark:text-gray-400 dark:hover:text-gray-200
              text-2xl leading-none
            "
          >
            &times;
          </button>
        </div>

        {/* body */}
        <div className="flex gap-6 flex-1 min-h-0">
          {/* sidebar */}
          <div
            className="
              flex flex-col gap-2
              w-44
              border-r border-gray-200 dark:border-gray-700
              pr-4
              flex-none
            "
          >
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveView(tab.id)}
                className={`
                  w-full text-left px-4 py-2 text-base rounded-md border
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
          <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex justify-end mb-3 flex-none">
              <button
                type="button"
                onClick={handleOpenFaqsPage}
                className="
                  px-3 py-1.5
                  rounded-md
                  text-sm
                  bg-blue-600 text-white
                  hover:bg-blue-700
                  dark:bg-blue-500 dark:hover:bg-blue-900
                "
              >
                Open FAQs Page
              </button>
            </div>

            <div
              className="
                faq-content
                flex-1
                h-full
                overflow-y-auto overscroll-y-contain
                px-4
                pt-4
                pb-2
              "
            >
              {TAB_CONTENT[activeView]}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FAQModal;
