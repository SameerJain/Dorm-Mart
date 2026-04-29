import DetailRow from "../../../components/DetailRow";
import { formatCurrency, formatDate } from "../../../utils/formatters";

const EMPTY_VALUE = "\u2014";

export default function ItemFactsPanel({ normalized, variant = "product" }) {
  if (variant === "receipt") {
    return <ReceiptFactsPanel normalized={normalized} />;
  }

  return <ProductFactsPanel normalized={normalized} />;
}

function ProductFactsPanel({ normalized }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200/70 dark:border-gray-700/70 p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
      <div className="space-y-2">
        <DetailRow
          label="Item location"
          value={normalized.itemLocation || EMPTY_VALUE}
        />
        <DetailRow
          label="Condition"
          value={normalized.itemCondition || EMPTY_VALUE}
        />
        <DetailRow
          label="Price Negotiable"
          value={normalized.priceNego ? "Yes" : "No"}
        />
        <DetailRow
          label="Accepts trades"
          value={normalized.trades ? "Yes" : "No"}
        />
        <DetailRow
          label="Seller email"
          value={normalized.sellerEmail || EMPTY_VALUE}
          suppressContactDetection
        />
      </div>
      <div className="space-y-2">
        <DetailRow
          label="Date listed"
          value={
            normalized.dateListed
              ? formatDate(normalized.dateListed)
              : EMPTY_VALUE
          }
        />
        {normalized.sold ? (
          <DetailRow
            label="Date sold"
            value={
              normalized.dateSold
                ? formatDate(normalized.dateSold)
                : EMPTY_VALUE
            }
          />
        ) : null}
        {normalized.sold && normalized.finalPrice != null ? (
          <DetailRow
            label="Final price"
            value={
              formatCurrency(normalized.finalPrice) ??
              `$${Number(normalized.finalPrice).toFixed(2)}`
            }
          />
        ) : null}
      </div>
    </div>
  );
}

function ReceiptFactsPanel({ normalized }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200/70 dark:border-gray-700/70 p-3 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
      <DetailRow
        align="start"
        label="Location"
        value={normalized.itemLocation || EMPTY_VALUE}
      />
      <DetailRow
        align="start"
        label="Condition"
        value={normalized.itemCondition || EMPTY_VALUE}
      />
      <DetailRow
        align="start"
        label="Negotiable"
        value={normalized.priceNego ? "Yes" : "No"}
      />
      <DetailRow
        align="start"
        label="Trades"
        value={normalized.trades ? "Yes" : "No"}
      />
      <DetailRow
        align="start"
        label="Listed"
        value={
          normalized.dateListed
            ? formatDate(normalized.dateListed)
            : EMPTY_VALUE
        }
      />
      {normalized.sold && (
        <DetailRow
          align="start"
          label="Date sold"
          value={
            normalized.dateSold ? formatDate(normalized.dateSold) : EMPTY_VALUE
          }
        />
      )}
      {normalized.sellerEmail && (
        <DetailRow
          align="start"
          label="Email"
          value={normalized.sellerEmail}
          suppressContactDetection
        />
      )}
    </div>
  );
}
