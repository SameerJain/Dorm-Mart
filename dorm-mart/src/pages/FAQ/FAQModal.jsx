import { useNavigate } from "react-router-dom";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";
import { TABS } from "./faqUtils";
import { FAQ_CONTENT } from "./faqContent";

function FAQModal({ isOpen, onClose, activeView, onTabChange }) {
  const navigate = useNavigate();

  useBodyScrollLock(isOpen);

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
        overscroll-none p-4
      "
      onClick={onClose}
    >
      <div
        className="
          bg-white dark:bg-gray-800
          rounded-lg shadow-lg
          p-4 sm:p-5
          w-full max-w-6xl
          h-[85dvh] sm:h-[70vh]
          max-h-[calc(100dvh-2rem)]
          border-2 border-gray-300 dark:border-gray-600
          flex flex-col
          min-w-0
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
        <div className="flex items-center justify-between gap-3 mb-4 sm:mb-5 flex-none">
          <h2 className="min-w-0 truncate text-xl sm:text-2xl font-semibold text-gray-900 dark:text-gray-100">
            Frequently Asked Questions
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close QnA modal"
            className="
              flex-none
              text-gray-500 hover:text-gray-700
              dark:text-gray-400 dark:hover:text-gray-200
              text-2xl leading-none
            "
          >
            &times;
          </button>
        </div>

        {/* body */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-6 flex-1 min-h-0 min-w-0">
          {/* sidebar */}
          <div
            className="
              flex flex-row sm:flex-col gap-2
              w-full sm:w-44
              border-b sm:border-b-0 sm:border-r border-gray-200 dark:border-gray-700
              pb-3 sm:pb-0 sm:pr-4
              flex-none
              overflow-x-auto sm:overflow-y-auto
              min-w-0
            "
          >
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange(tab.id)}
                className={`
                  flex-none sm:w-full text-left whitespace-nowrap sm:whitespace-normal px-4 py-2 text-sm sm:text-base rounded-lg border
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
          <div className="flex-1 min-h-0 min-w-0 flex flex-col">
            <div className="flex justify-end mb-3 flex-none">
              <button
                type="button"
                onClick={handleOpenFaqsPage}
                className="
                  px-3 py-1.5
                  rounded-lg
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
                break-words
                px-4
                pt-4
                pb-2
              "
            >
              {FAQ_CONTENT[activeView]}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FAQModal;
