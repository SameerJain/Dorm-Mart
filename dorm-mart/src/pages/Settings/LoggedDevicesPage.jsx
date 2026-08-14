import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import SettingsLayout from "./SettingsLayout";
import { API_BASE } from "../../utils/apiConfig";
import { formatLoginTimestamp } from "./loggedDevicesUtils";

function DeviceIcon({ type }) {
  const isMobile = type === "Mobile";
  const isTablet = type === "Tablet";

  return (
    <div className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-6 w-6" strokeWidth="1.8">
        {isMobile ? (
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 2.75h8a1.25 1.25 0 0 1 1.25 1.25v16A1.25 1.25 0 0 1 16 21.25H8A1.25 1.25 0 0 1 6.75 20V4A1.25 1.25 0 0 1 8 2.75ZM10.5 18.5h3" />
        ) : isTablet ? (
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.5 2.75h11A1.25 1.25 0 0 1 18.75 4v16a1.25 1.25 0 0 1-1.25 1.25h-11A1.25 1.25 0 0 1 5.25 20V4A1.25 1.25 0 0 1 6.5 2.75ZM11 18.5h2" />
        ) : (
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 4.75h18v12.5H3V4.75Zm5 16.5h8m-4-4v4" />
        )}
      </svg>
    </div>
  );
}

function DeviceCard({ device }) {
  return (
    <li className="rounded-xl border border-slate-200 p-4 dark:border-gray-700 sm:p-5">
      <div className="flex items-start gap-4">
        <DeviceIcon type={device.device_type} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold text-slate-900 dark:text-gray-100">
              {device.browser} on {device.operating_system}
            </h2>
            {device.is_current ? (
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                Current device
              </span>
            ) : device.signed_out_at ? (
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-gray-700 dark:text-gray-300">
                Signed out
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-slate-600 dark:text-gray-300">{device.device_type}</p>

          <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-medium text-slate-500 dark:text-gray-400">Location</dt>
              <dd className="mt-0.5 text-slate-800 dark:text-gray-200">{device.location || "Location unavailable"}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500 dark:text-gray-400">IP address</dt>
              <dd className="mt-0.5 break-all font-mono text-slate-800 dark:text-gray-200">{device.ip_address}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500 dark:text-gray-400">Logged in</dt>
              <dd className="mt-0.5 text-slate-800 dark:text-gray-200">{formatLoginTimestamp(device.logged_in_at)}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500 dark:text-gray-400">Last active</dt>
              <dd className="mt-0.5 text-slate-800 dark:text-gray-200">{formatLoginTimestamp(device.last_seen_at)}</dd>
            </div>
          </dl>
        </div>
      </div>
    </li>
  );
}

export default function LoggedDevicesPage() {
  const navigate = useNavigate();
  const [devices, setDevices] = useState(null);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      setError("");
      try {
        const response = await fetch(`${API_BASE}/auth/login_history.php`, {
          credentials: "include",
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });
        const data = await response.json().catch(() => null);
        if (!response.ok || !data?.success) {
          throw new Error(data?.error || "Unable to load logged devices.");
        }
        setDevices(Array.isArray(data.devices) ? data.devices : []);
      } catch (err) {
        if (err.name !== "AbortError") {
          setError(err.message || "Unable to load logged devices.");
        }
      }
    })();

    return () => controller.abort();
  }, [reloadKey]);

  return (
    <SettingsLayout>
      <div className="mx-auto max-w-4xl">
        <header className="border-b border-slate-200 pb-4 dark:border-gray-700">
          <h1 className="font-serif text-2xl font-semibold text-blue-600 dark:text-blue-400">Logged Devices</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-gray-300">
            Review successful logins to your Dorm Mart account.
          </p>
        </header>

        <section className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
          <h2 className="font-semibold text-amber-900 dark:text-amber-200">See a login you do not recognize?</h2>
          <p className="mt-1 text-sm text-amber-800 dark:text-amber-300">
            Change your password immediately to protect your account.
          </p>
          <button
            type="button"
            onClick={() => navigate("/app/setting/change-password")}
            className="mt-3 rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-800 dark:bg-amber-600 dark:hover:bg-amber-700"
          >
            Change Password
          </button>
        </section>

        {error ? (
          <div role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            <p>{error}</p>
            <button type="button" onClick={() => setReloadKey((key) => key + 1)} className="mt-3 font-semibold underline">
              Try again
            </button>
          </div>
        ) : devices === null ? (
          <p className="mt-6 text-slate-500 dark:text-gray-400">Loading logged devices...</p>
        ) : devices.length === 0 ? (
          <p className="mt-6 rounded-xl border border-slate-200 p-5 text-slate-600 dark:border-gray-700 dark:text-gray-300">
            No login history is available yet.
          </p>
        ) : (
          <ul className="mt-6 space-y-4">
            {devices.map((device) => <DeviceCard key={device.id} device={device} />)}
          </ul>
        )}

        <p className="mt-6 text-xs text-slate-500 dark:text-gray-400">
          Location is approximate and depends on information supplied by your network provider. Only successful logins are shown.
        </p>
      </div>
    </SettingsLayout>
  );
}
