import { useEffect, useState } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { API_BASE } from "../../../utils/apiConfig";
import { csrfPostJson } from "../../../utils/apiClient";

export default function ElectronicPaymentModal({ onClose, onStatusChange, scheduledRequestId }) {
  const [setup, setSetup] = useState(null);
  const [stripePromise, setStripePromise] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      import("@stripe/stripe-js"),
      csrfPostJson(`${API_BASE}/payments/create_intent.php`, {
        scheduled_request_id: scheduledRequestId,
      }),
    ])
      .then(([stripeModule, result]) => {
        if (cancelled) return;
        const data = result?.data;
        if (!data?.client_secret || !data?.publishable_key) throw new Error("Payment could not be prepared.");
        setSetup(data);
        setStripePromise(stripeModule.loadStripe(data.publishable_key, {
          stripeAccount: data.connected_account_id,
        }));
      })
      .catch((setupError) => {
        if (!cancelled) setError(setupError.message || "Payment could not be prepared.");
      });
    return () => {
      cancelled = true;
    };
  }, [scheduledRequestId]);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="electronic-payment-title">
      <div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl dark:bg-gray-800">
        <div className="flex items-start justify-between border-b border-gray-200 p-5 dark:border-gray-700">
          <div>
            <h2 id="electronic-payment-title" className="text-xl font-bold text-gray-900 dark:text-gray-100">Make an Electronic Payment</h2>
            {setup && <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">Pay ${(setup.amount_cents / 100).toFixed(2)} USD directly to the seller.</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close payment" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:hover:bg-gray-700">✕</button>
        </div>
        <div className="p-5">
          {setup?.is_test_mode && <p className="mb-4 rounded-lg bg-amber-100 px-3 py-2 text-sm font-semibold text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">Test Mode — no real money will move.</p>}
          {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</p>}
          {!setup && !error && <p className="text-sm text-gray-500">Preparing secure payment…</p>}
          {setup && stripePromise && (
            <Elements stripe={stripePromise} options={{ clientSecret: setup.client_secret, appearance: { theme: "stripe" } }}>
              <PaymentForm cutoff={setup.window_ends_at} onClose={onClose} onStatusChange={onStatusChange} />
            </Elements>
          )}
        </div>
      </div>
    </div>
  );
}

function PaymentForm({ cutoff, onClose, onStatusChange }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event) {
    event.preventDefault();
    if (!stripe || !elements || submitting) return;
    if (Date.now() >= new Date(cutoff).getTime()) {
      setMessage("The Payment Window has closed.");
      await onStatusChange();
      return;
    }
    setSubmitting(true);
    setMessage("");
    const result = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}${window.location.pathname}#/app/chat` },
      redirect: "if_required",
    });
    if (result.error) {
      setMessage(result.error.message || "Payment was not completed. You can retry before the window closes.");
      setSubmitting(false);
      return;
    }
    setMessage("Payment submitted. Waiting for Stripe to verify completion…");
    await onStatusChange();
    setSubmitting(false);
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <PaymentElement options={{ layout: "tabs", wallets: { applePay: "auto", googlePay: "auto" } }} />
      {message && <p role="status" className="text-sm text-gray-700 dark:text-gray-200">{message}</p>}
      <div className="flex justify-end gap-3">
        <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700">Cancel</button>
        <button type="submit" disabled={!stripe || submitting} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60">{submitting ? "Processing…" : "Pay Now"}</button>
      </div>
      <p className="text-xs leading-5 text-gray-500 dark:text-gray-400">Payment must succeed before the 30-minute cutoff. Stripe processes your payment details; Dorm Mart does not store card data or hold funds.</p>
    </form>
  );
}
