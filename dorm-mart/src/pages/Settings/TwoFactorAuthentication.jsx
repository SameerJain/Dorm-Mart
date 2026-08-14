import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import SettingsLayout from "./SettingsLayout";
import PageBackButton from "../../components/PageBackButton";
import { API_BASE } from "../../utils/apiConfig";
import { csrfFetch } from "../../utils/csrfFetch";

async function responseMessage(response) {
  const data = await response.json().catch(() => ({}));
  return { data, message: data.error || data.message || "Unable to update Two-Factor Authentication." };
}

export default function TwoFactorAuthentication() {
  const navigate = useNavigate();
  const [enabled, setEnabled] = useState(null);
  const [email, setEmail] = useState("");
  const [mode, setMode] = useState(null);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_BASE}/auth/two_factor.php`, {
      credentials: "include",
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = await responseMessage(response);
        if (!response.ok || !result.data.ok) throw new Error(result.message);
        setEnabled(Boolean(result.data.enabled));
        setEmail(result.data.email || "your account email");
      })
      .catch((requestError) => {
        if (requestError.name !== "AbortError") setError(requestError.message);
      });
    return () => controller.abort();
  }, []);

  const confirmChange = async () => {
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const response = await csrfFetch(`${API_BASE}/auth/two_factor.php`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: mode, password }),
      });
      const result = await responseMessage(response);
      if (!response.ok || !result.data.ok) throw new Error(result.message);

      setEnabled(Boolean(result.data.enabled));
      setMessage(result.data.message);
      setMode(null);
      setPassword("");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SettingsLayout>
      <div className="mb-6 flex items-center justify-between border-b border-slate-200 pb-3 dark:border-gray-700">
        <h1 className="text-2xl font-serif font-semibold text-blue-600 dark:text-blue-400">
          Two-Factor Authentication
        </h1>
        <PageBackButton onClick={() => navigate(-1)} />
      </div>

      <div className="max-w-2xl">
        <p className="text-gray-700 dark:text-gray-300">
          Add a one-time verification code, delivered by email, whenever you log in.
        </p>

        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-5 dark:border-gray-700 dark:bg-gray-900">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-gray-900 dark:text-gray-100">
                Status: {enabled === null ? "Loading..." : enabled ? "Enabled" : "Disabled"}
              </p>
              {email && (
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  Verification codes will be sent to {email}.
                </p>
              )}
            </div>
            <button
              type="button"
              disabled={enabled === null || loading}
              onClick={() => {
                setMode(enabled ? "disable" : "enable");
                setError("");
                setMessage("");
              }}
              className="h-11 rounded-xl bg-blue-600 px-5 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              {enabled ? "Disable 2FA" : "Enable 2FA"}
            </button>
          </div>
        </div>

        {mode && (
          <div className="mt-5 rounded-xl border border-blue-200 p-5 dark:border-blue-900">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">
              {mode === "enable" ? "Enable email verification?" : "Confirm your password"}
            </h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              {mode === "enable"
                ? "After enabling, each new login will require a code sent to your account email."
                : "Enter your current account password to disable Two-Factor Authentication."}
            </p>
            {mode === "disable" && (
              <div className="mt-4">
                <label htmlFor="two-factor-password" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Current password
                </label>
                <input
                  id="two-factor-password"
                  type="password"
                  maxLength={64}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-11 w-full max-w-md rounded-xl border border-slate-300 bg-white px-4 text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                />
              </div>
            )}
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                disabled={loading || (mode === "disable" && password === "")}
                onClick={confirmChange}
                className="h-10 rounded-lg bg-blue-600 px-5 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
              >
                {loading ? "Saving..." : "Confirm"}
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  setMode(null);
                  setPassword("");
                }}
                className="h-10 rounded-lg border border-slate-300 px-5 text-gray-700 hover:bg-slate-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {message && <p role="status" className="mt-5 rounded-lg bg-green-100 p-3 text-green-800">{message}</p>}
        {error && <p role="alert" className="mt-5 rounded-lg bg-red-100 p-3 text-red-800">{error}</p>}
      </div>
    </SettingsLayout>
  );
}
