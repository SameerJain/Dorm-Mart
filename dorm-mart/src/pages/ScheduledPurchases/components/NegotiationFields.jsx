import { decimalNumericKeyDownHandler } from "../../../utils/numericInputKeyHandlers";
import { MAX_LISTING_PRICE } from "../../../utils/priceValidation";

export default function NegotiationFields({
  isTrade,
  negotiatedPrice,
  selectedListing,
  setIsTrade,
  setNegotiatedPrice,
  setTradeItemDescription,
  tradeItemDescription,
}) {
  return (
    <>
      {selectedListing?.priceNegotiable && (
        <div className="max-w-xs">
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
            Negotiated Price (Optional)
          </label>
          {selectedListing?.price && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 font-medium">
              Listed price: ${Number(selectedListing.price).toFixed(2)}
            </p>
          )}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 text-lg">
                $
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={negotiatedPrice}
                maxLength={7}
                onKeyDown={decimalNumericKeyDownHandler}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === "") {
                    setNegotiatedPrice("");
                    return;
                  }
                  if (!/^\d{0,4}(?:\.\d{0,2})?$/.test(value)) return;
                  const numValue = parseFloat(value);
                  if (!Number.isNaN(numValue) && numValue <= MAX_LISTING_PRICE) {
                    setNegotiatedPrice(value);
                  }
                }}
                disabled={isTrade}
                className={`w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${isTrade ? "opacity-50 cursor-not-allowed" : ""}`}
              />
            </div>
            {selectedListing?.acceptTrades && (
              <TradeToggle
                isTrade={isTrade}
                setIsTrade={setIsTrade}
                setNegotiatedPrice={setNegotiatedPrice}
                setTradeItemDescription={setTradeItemDescription}
              />
            )}
          </div>
          <PriceComparison
            negotiatedPrice={negotiatedPrice}
            listedPrice={selectedListing?.price}
          />
        </div>
      )}

      {selectedListing?.acceptTrades && !selectedListing?.priceNegotiable && (
        <div>
          <TradeToggle
            isTrade={isTrade}
            setIsTrade={setIsTrade}
            setNegotiatedPrice={setNegotiatedPrice}
            setTradeItemDescription={setTradeItemDescription}
            strongLabel
          />
        </div>
      )}

      {selectedListing?.acceptTrades && isTrade && (
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
            Item You Are Trading For <span className="text-red-500">*</span>
          </label>
          <textarea
            value={tradeItemDescription}
            onChange={(e) => setTradeItemDescription(e.target.value)}
            rows={3}
            maxLength={100}
            placeholder="Describe the item you are trading..."
            className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
            required={isTrade}
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {tradeItemDescription.length}/100 characters
          </p>
        </div>
      )}
    </>
  );
}

function TradeToggle({
  isTrade,
  setIsTrade,
  setNegotiatedPrice,
  setTradeItemDescription,
  strongLabel = false,
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer whitespace-nowrap">
      <input
        type="checkbox"
        checked={isTrade}
        onChange={(e) => {
          setIsTrade(e.target.checked);
          if (e.target.checked) {
            setNegotiatedPrice("");
          } else {
            setTradeItemDescription("");
          }
        }}
        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
      />
      <span
        className={`text-sm text-gray-700 dark:text-gray-300 ${strongLabel ? "font-semibold" : ""}`}
      >
        This is an item trade
      </span>
    </label>
  );
}

function PriceComparison({ listedPrice, negotiatedPrice }) {
  if (!negotiatedPrice.trim() || !listedPrice) return null;
  const negotiatedPriceValue = parseFloat(negotiatedPrice);
  const listedPriceValue = parseFloat(listedPrice);
  if (Number.isNaN(negotiatedPriceValue) || Number.isNaN(listedPriceValue)) {
    return null;
  }
  if (negotiatedPriceValue === listedPriceValue) return null;

  const isHigher = negotiatedPriceValue > listedPriceValue;
  return (
    <div className="mt-2 flex items-start gap-2">
      <svg
        className={`w-4 h-4 flex-shrink-0 mt-0.5 ${isHigher ? "text-orange-600 dark:text-orange-400" : "text-blue-600 dark:text-blue-400"}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d={
            isHigher
              ? "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              : "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
          }
        />
      </svg>
      <p
        className={`text-sm ${isHigher ? "text-orange-600 dark:text-orange-400" : "text-blue-600 dark:text-blue-400"}`}
      >
        {isHigher
          ? "Please note that this is higher than the listed price"
          : "This is lower than the listed price"}
      </p>
    </div>
  );
}
