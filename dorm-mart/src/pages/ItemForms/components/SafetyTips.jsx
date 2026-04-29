export default function SafetyTips() {
  return (
    <div className="bg-blue-50 dark:bg-blue-950/30 rounded-2xl border border-blue-200 dark:border-blue-900/40 p-6 mt-6">
      <h3 className="text-2xl font-bold text-blue-900 dark:text-blue-100 mb-4">
        Safety Tips
      </h3>
      <ul className="text-sm text-blue-800 dark:text-blue-100 space-y-3">
        <li className="flex items-start gap-2">
          <span className="text-blue-600 dark:text-blue-200 flex-shrink-0">
            â€¢
          </span>
          <span>
            Consider bringing a friend, especially for high value items.
          </span>
        </li>
        <li className="flex items-start gap-2">
          <span className="text-blue-600 dark:text-blue-200 flex-shrink-0">
            â€¢
          </span>
          <span>Report suspicious messages or behavior.</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="text-blue-600 dark:text-blue-200 flex-shrink-0">
            â€¢
          </span>
          <span>Trust your gut. Don't proceed if something feels off.</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="text-blue-600 dark:text-blue-200 flex-shrink-0">
            â€¢
          </span>
          <span>Keep receipts or transaction records.</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="text-blue-600 dark:text-blue-200 flex-shrink-0">
            â€¢
          </span>
          <span>Use secure payment methods (cash, Venmo, Zelle).</span>
        </li>
      </ul>
    </div>
  );
}
