import { useCallback, useEffect, useState } from "react";
import SettingsLayout from "./SettingsLayout";
import { API_BASE } from "../../utils/apiConfig";
import { apiGetJson, csrfPostJson } from "../../utils/apiClient";

export default function PaymentsPage() {
  const [account, setAccount] = useState(null);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  const loadAccount = useCallback(async () => {
    try {
      setError("");
      const result = await apiGetJson(`${API_BASE}/payments/account_status.php`);
      setAccount(result?.data || null);
    } catch (loadError) {
      setError(loadError.message || "Unable to load payment settings.");
    }
  }, []);

  useEffect(() => {
    loadAccount();
  }, [loadAccount]);

  async function startOnboarding() {
    setWorking(true);
    setError("");
    try {
      const result = await csrfPostJson(`${API_BASE}/payments/onboard.php`, {});
      if (!result?.data?.url) throw new Error("Stripe did not return an onboarding link.");
      window.location.assign(result.data.url);
    } catch (onboardingError) {
      setError(onboardingError.message || "Unable to start Stripe onboarding.");
      setWorking(false);
    }
  }

  async function disconnect() {
    if (!window.confirm("Disconnect Stripe? Payment-enabled schedules will permanently return to manual confirmation.")) return;
    setWorking(true);
    setError("");
    try {
      await csrfPostJson(`${API_BASE}/payments/disconnect.php`, {});
      await loadAccount();
    } catch (disconnectError) {
      setError(disconnectError.message || "Unable to disconnect Stripe.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <SettingsLayout>
      <div className="mx-auto max-w-3xl">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Payments</h1>
          {account?.is_test_mode && (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
              Test Mode
            </span>
          )}
        </div>
        <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">
          Connect Stripe to offer card and eligible wallet payments for Scheduled Purchases. You are the merchant of record, receive funds directly, and pay Stripe’s processing fees.
        </p>

        {!account ? (
          <p className="mt-8 text-sm text-gray-500">Loading payment settings…</p>
        ) : !account.feature_enabled ? (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
            Payments are not enabled on this installation yet. Configure Stripe, HTTPS, wallet domains, and both webhook modes before turning on the payment feature flag.
          </div>
        ) : (
          <div className="mt-6 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
            <div className="border-b border-gray-200 bg-gray-50 p-5 dark:border-gray-700 dark:bg-gray-900/50">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Stripe status</p>
              <p className="mt-2 text-xl font-semibold text-gray-900 dark:text-gray-100">
                {account.ready ? "Ready to accept payments" : account.connected ? "Onboarding incomplete" : "Not connected"}
              </p>
            </div>
            <dl className="grid gap-4 p-5 sm:grid-cols-3">
              <Status label="Identity details" ready={account.details_submitted} />
              <Status label="Card payments" ready={account.charges_enabled} />
              <Status label="Payouts" ready={account.payouts_enabled} />
            </dl>
            <div className="flex flex-wrap gap-3 border-t border-gray-200 p-5 dark:border-gray-700">
              {!account.ready && (
                <button type="button" onClick={startOnboarding} disabled={working} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60">
                  {account.connected ? "Continue Stripe Setup" : "Connect Stripe"}
                </button>
              )}
              {account.connected && (
                <a href={account.dashboard_url} target="_blank" rel="noreferrer" className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-700">
                  Open Stripe Dashboard
                </a>
              )}
              {account.connected && (
                <button type="button" onClick={disconnect} disabled={working} className="rounded-lg px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-60 dark:text-red-400 dark:hover:bg-red-950/30">
                  Disconnect
                </button>
              )}
            </div>
          </div>
        )}

        {error && <p role="alert" className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="mt-8 rounded-xl border border-gray-200 p-5 text-sm leading-6 text-gray-600 dark:border-gray-700 dark:text-gray-300">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">Before you connect</h2>
          <p className="mt-2">This feature supports US sellers age 18 or older and USD payments. Stripe handles identity verification, payment details, payouts, refunds, and disputes. Dorm Mart does not hold funds or guarantee the item handoff.</p>
        </div>
      </div>
    </SettingsLayout>
  );
}

function Status({ label, ready }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className={`mt-1 font-semibold ${ready ? "text-emerald-700 dark:text-emerald-400" : "text-gray-700 dark:text-gray-300"}`}>
        {ready ? "Ready" : "Required"}
      </dd>
    </div>
  );
}
