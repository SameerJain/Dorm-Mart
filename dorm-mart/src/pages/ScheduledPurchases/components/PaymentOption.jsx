import { decimalNumericKeyDownHandler } from "../../../utils/numericInputKeyHandlers";

export default function PaymentOption({
  amount,
  eligibility,
  isTrade,
  loading,
  onAmountChange,
  onToggle,
  selected,
}) {
  const available = Boolean(eligibility?.eligible) && !isTrade;
  const reason = isTrade
    ? "Built-in payment is not available for item trades."
    : eligibility?.reason;

  return (
    <fieldset className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 dark:border-blue-800 dark:bg-blue-950/30">
      <legend className="px-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
        Payment
      </legend>
      <label className={`flex items-start gap-3 ${available ? "cursor-pointer" : "cursor-not-allowed"}`}>
        <input
          type="checkbox"
          checked={selected}
          disabled={!available || loading}
          onChange={(event) => onToggle(event.target.checked)}
          className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
        />
        <span>
          <span className="block text-sm font-semibold text-gray-900 dark:text-gray-100">
            Use built-in payment
            {eligibility?.is_test_mode && (
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                Test Mode
              </span>
            )}
          </span>
          <span className="mt-1 block text-sm text-gray-600 dark:text-gray-300">
            The buyer can pay during the 30-minute window. Successful payment completes the purchase automatically.
          </span>
        </span>
      </label>

      {loading && <p className="mt-3 text-sm text-gray-500">Checking Stripe availability…</p>}
      {!loading && !available && reason && (
        <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">{reason}</p>
      )}

      {selected && available && (
        <div className="mt-4 max-w-xs">
          <label htmlFor="payment-amount" className="mb-2 block text-sm font-semibold text-gray-800 dark:text-gray-200">
            Locked payment amount
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
            <input
              id="payment-amount"
              type="text"
              inputMode="decimal"
              value={amount}
              maxLength={7}
              onKeyDown={decimalNumericKeyDownHandler}
              onChange={(event) => {
                const value = event.target.value;
                if (value === "" || /^\d{0,4}(?:\.\d{0,2})?$/.test(value)) onAmountChange(value);
              }}
              required
              className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-7 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900"
            />
          </div>
          <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
            Buyer acceptance locks this USD amount. You receive the payment directly and pay Stripe’s processing fee.
          </p>
        </div>
      )}
    </fieldset>
  );
}
