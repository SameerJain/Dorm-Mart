import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import SettingsLayout from "./SettingsLayout";
import { API_BASE } from "../../utils/apiConfig";
import { formatAccountDate, formatGraduationDate } from "./accountInfoUtils";

function InfoRow({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-900/50">
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400">{label}</dt>
      <dd className="mt-1 break-words text-base font-medium text-slate-900 dark:text-gray-100">{value || "Not available"}</dd>
    </div>
  );
}

export default function AccountInfoPage() {
  const [account, setAccount] = useState(null);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const response = await fetch(`${API_BASE}/profile/account_info.php`, {
          credentials: "include", signal: controller.signal,
        });
        const data = await response.json().catch(() => null);
        if (!response.ok || !data?.success) throw new Error(data?.error || "Unable to load account information.");
        setAccount(data.account || {});
      } catch (err) {
        if (err.name !== "AbortError") setError(err.message || "Unable to load account information.");
      }
    })();
    return () => controller.abort();
  }, []);

  const openLegal = (path) => navigate(path, { state: { from: "/app/setting/personal-information" } });

  return (
    <SettingsLayout>
      <div className="mx-auto max-w-3xl">
        <header className="border-b border-slate-200 pb-4 dark:border-gray-700">
          <h1 className="font-serif text-2xl font-semibold text-blue-600 dark:text-blue-400">Account Info</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-gray-300">Information associated with your Dorm Mart account.</p>
        </header>

        {error ? (
          <div role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{error}</div>
        ) : !account ? (
          <p className="mt-6 text-slate-500 dark:text-gray-400">Loading account information...</p>
        ) : (
          <dl className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <InfoRow label="First name" value={account.first_name} />
            <InfoRow label="Last name" value={account.last_name} />
            <div className="sm:col-span-2"><InfoRow label="UB email" value={account.email} /></div>
            <InfoRow label="Graduation date" value={formatGraduationDate(account.grad_month, account.grad_year)} />
            <InfoRow label="Account created" value={formatAccountDate(account.join_date)} />
          </dl>
        )}

        <section className="mt-8 border-t border-slate-200 pt-6 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-gray-100">Legal</h2>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <button type="button" onClick={() => openLegal("/privacy-policy")} className="rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white hover:bg-blue-700 dark:bg-blue-800 dark:hover:bg-blue-900">View Privacy Policy</button>
            <button type="button" onClick={() => openLegal("/terms-of-service")} className="rounded-lg border border-blue-600 px-4 py-2.5 font-medium text-blue-700 hover:bg-blue-50 dark:border-blue-400 dark:text-blue-300 dark:hover:bg-gray-700">View Terms of Service</button>
          </div>
        </section>
      </div>
    </SettingsLayout>
  );
}
