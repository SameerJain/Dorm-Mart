export default function PaymentSystemMessageCard({ message }) {
  const metadata = message.metadata || {};
  const type = metadata.type;
  const amount = metadata.payment_amount_cents != null
    ? `$${(Number(metadata.payment_amount_cents) / 100).toFixed(2)} USD`
    : null;
  const content = {
    payment_completed: ["Electronic Payment Completed", amount ? `${amount} was paid directly to the seller.` : "Stripe verified the payment."],
    payment_fallback: ["Manual Confirmation Restored", "Built-in payment is no longer available for this Scheduled Purchase."],
    payment_refunded: ["Electronic Payment Refunded", amount ? `${amount} was refunded through Stripe.` : "The payment was refunded through Stripe."],
  }[type] || ["Payment Update", message.content];

  return (
    <div className="mx-auto my-2 max-w-md rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center shadow-sm dark:border-emerald-800 dark:bg-emerald-950/30">
      <p className="text-xs font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-300">{content[0]}</p>
      <p className="mt-1 text-sm text-emerald-950 dark:text-emerald-100">{content[1]}</p>
      {metadata.confirm_request_id && (
        <a href={`#/app/viewReceipt?confirm_request_id=${metadata.confirm_request_id}`} className="mt-2 inline-block text-sm font-semibold text-emerald-800 underline hover:no-underline dark:text-emerald-200">View receipt</a>
      )}
    </div>
  );
}
