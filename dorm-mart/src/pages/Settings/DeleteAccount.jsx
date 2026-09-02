import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import PageBackButton from "../../components/PageBackButton";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";
import { API_BASE } from "../../utils/apiConfig";
import { clearCsrfToken, csrfFetch } from "../../utils/csrfFetch";
import { fetchMe } from "../../utils/handleAuth";
import { THEME_CACHE_KEY, THEME_PENDING_KEY } from "../../utils/loadTheme";
import SettingsLayout from "./SettingsLayout";

const CONFIRMATION = "DELETE MY ACCOUNT";

function DeleteAccountPage() {
  const navigate = useNavigate();
  const userIdRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [confirmation, setConfirmation] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useBodyScrollLock(isOpen);

  useEffect(() => {
    fetchMe().then((data) => {
      userIdRef.current = data.user_id;
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape" && !isSubmitting) closeModal();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  });

  const closeModal = () => {
    setIsOpen(false);
    setStep(1);
    setConfirmation("");
    setPassword("");
    setError("");
  };

  const canDelete = confirmation === CONFIRMATION && password.length > 0;

  const deleteAccount = async () => {
    if (!canDelete || isSubmitting) return;
    setIsSubmitting(true);
    setError("");

    try {
      const response = await csrfFetch(`${API_BASE}/auth/delete_account.php`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation, currentPassword: password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || "Unable to delete your account. Please try again.");
        return;
      }

      clearCsrfToken();
      try {
        localStorage.removeItem(THEME_CACHE_KEY);
        localStorage.removeItem(THEME_PENDING_KEY);
        if (userIdRef.current) localStorage.removeItem(`userTheme_${userIdRef.current}`);
        sessionStorage.removeItem("dm_home_feed_tab");
      } catch (_) {}
      document.documentElement.classList.remove("dark");
      document.documentElement.style.colorScheme = "light";
      navigate("/", { replace: true });
    } catch {
      setError("Network error while deleting your account. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SettingsLayout>
      <div className="mb-6 flex items-center justify-between border-b border-slate-200 pb-3 dark:border-gray-700">
        <h1 className="font-serif text-2xl font-semibold text-blue-600 dark:text-blue-400">
          Delete Account
        </h1>
        <PageBackButton onClick={() => navigate(-1)} />
      </div>

      <section className="max-w-2xl rounded-xl border border-red-300 bg-red-50 p-6 dark:border-red-800 dark:bg-red-950/30">
        <h2 className="font-serif text-xl font-semibold text-red-800 dark:text-red-300">
          Permanently delete your Dorm Mart account
        </h2>
        <p className="mt-2 text-sm leading-6 text-red-700 dark:text-red-200">
          This action cannot be undone. Your account, listings, profile, preferences, and saved items will be permanently removed.
        </p>
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="mt-5 rounded-xl bg-red-600 px-5 py-2.5 font-semibold text-white shadow hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
        >
          Delete my account
        </button>
      </section>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="presentation">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" aria-hidden="true" onClick={isSubmitting ? undefined : closeModal} />
          <div
            className="relative z-10 max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-gray-200 bg-white p-4 shadow-2xl dark:border-gray-700 dark:bg-gray-800 sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-account-title"
          >
            {step === 1 ? (
              <>
                <h2 id="delete-account-title" className="font-serif text-2xl font-semibold text-red-700 dark:text-red-400">
                  Before you delete your account
                </h2>
                <p className="mt-3 text-gray-700 dark:text-gray-300">Deleting your account means:</p>
                <ul className="mt-3 list-disc space-y-2 pl-6 text-gray-700 dark:text-gray-300">
                  <li>Your listings will be permanently removed.</li>
                  <li>Your active chats will be closed.</li>
                  <li>Your wishlisted items will be removed.</li>
                  <li>Your account cannot be recovered.</li>
                </ul>
                <div className="mt-6 flex justify-end gap-3">
                  <button type="button" onClick={closeModal} className="rounded-xl border border-gray-300 px-4 py-2 font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700">
                    Cancel
                  </button>
                  <button type="button" onClick={() => setStep(2)} className="rounded-xl bg-red-600 px-4 py-2 font-semibold text-white hover:bg-red-700">
                    Continue
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 id="delete-account-title" className="font-serif text-2xl font-semibold text-red-700 dark:text-red-400">
                  Confirm permanent deletion
                </h2>
                <label htmlFor="delete-confirmation" className="mt-5 block text-sm font-medium text-gray-700 dark:text-gray-200">
                  Type <span className="font-bold">{CONFIRMATION}</span>
                </label>
                <input
                  id="delete-confirmation"
                  autoFocus
                  autoComplete="off"
                  spellCheck="false"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  className="mt-2 h-11 w-full rounded-xl border border-gray-300 px-3 text-gray-900 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                />
                <label htmlFor="delete-password" className="mt-4 block text-sm font-medium text-gray-700 dark:text-gray-200">
                  Current password
                </label>
                <input
                  id="delete-password"
                  type="password"
                  autoComplete="current-password"
                  maxLength={64}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="mt-2 h-11 w-full rounded-xl border border-gray-300 px-3 text-gray-900 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                />
                {error && <p className="mt-3 text-sm font-medium text-red-700 dark:text-red-400" role="alert">{error}</p>}
                <div className="mt-6 flex justify-between gap-3">
                  <button type="button" disabled={isSubmitting} onClick={() => { setStep(1); setError(""); }} className="rounded-xl border border-gray-300 px-4 py-2 font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700">
                    Back
                  </button>
                  <button
                    type="button"
                    disabled={!canDelete || isSubmitting}
                    onClick={deleteAccount}
                    className="rounded-xl bg-red-600 px-4 py-2 font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSubmitting ? "Deleting..." : "Delete my account"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </SettingsLayout>
  );
}

export default DeleteAccountPage;
