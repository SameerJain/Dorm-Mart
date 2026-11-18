import { InfoIcon } from "../../../components/Icons";

function NextStepsMessageCard({ message }) {
  const content = message.content || "";

  return (
    <div className="flex justify-center my-2">
      <div className="max-w-[85%] rounded-2xl border-2 border-orange-400 dark:border-orange-600 bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-300 overflow-hidden">
        <div className="p-4">
          <div className="flex items-start gap-2">
            <InfoIcon className="w-5 h-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-orange-800 dark:text-orange-200 mb-1">
                Next Steps: Meet In-Person
              </p>
              <p className="text-sm text-orange-700 dark:text-orange-300 break-words">
                {content}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default NextStepsMessageCard;
