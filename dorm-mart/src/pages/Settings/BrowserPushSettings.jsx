import { useEffect, useState } from "react";
import { browserPushState, enableBrowserPush, disableBrowserPush } from "../../utils/browserPush";

export default function BrowserPushSettings() {
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    browserPushState().then((value) => { if (!cancelled) setState(value); })
      .catch(() => { if (!cancelled) setError("Unable to load browser notification settings."); });
    return () => { cancelled = true; };
  }, [loadAttempt]);

  async function toggle() {
    setBusy(true);
    setError("");
    try {
      if (state.enabled) await disableBrowserPush();
      else await enableBrowserPush(state.publicKey);
      setState(await browserPushState());
    } catch (e) {
      setError(e.message || "Unable to update browser notifications.");
    } finally { setBusy(false); }
  }

  return (
    <div className="mt-6 border-t border-gray-200 pt-5 dark:border-gray-600">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Browser push notifications</h3>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">Get alerts for messages and purchase updates on this device, even when the tab is closed. Alerts hide message and purchase details.</p>
      {state?.supported === false && <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">Push notifications need a supported browser and a secure connection. On iPhone or iPad, open Dorm Mart from your Home Screen.</p>}
      {state?.supported && !state.configured && <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">Browser notifications are not available yet.</p>}
      {state?.permission === "denied" && <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">Notifications are blocked. Allow them in your browser’s site settings to enable alerts.</p>}
      {state?.supported && state.configured && <button type="button" disabled={busy || (!state.enabled && state.permission === "denied")} onClick={toggle}
        className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
        {busy ? "Updating…" : state.enabled ? "Disable browser notifications" : "Enable browser notifications"}
      </button>}
      {!state && !error && <p className="mt-2 text-sm text-gray-500">Loading notification settings…</p>}
      {error && <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-300">{error}</p>}
      {!state && error && <button type="button" onClick={() => { setError(""); setLoadAttempt((value) => value + 1); }} className="mt-2 rounded border px-3 py-1 text-sm">Retry</button>}
      {state?.enabled && <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Enabled for this sign-in. Signing out stops alerts; enable them again after your next sign-in.</p>}
    </div>
  );
}
