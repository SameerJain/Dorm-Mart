import { useNavigate } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import SettingsLayout from "./SettingsLayout";
import PageBackButton from "../../components/PageBackButton";
import PasswordRequirementRow from "../../components/forms/PasswordRequirementRow";
import { API_BASE } from "../../utils/apiConfig";
import { csrfFetch } from "../../utils/csrfFetch";
import {
  buildPasswordPolicy,
  MAX_PASSWORD_LEN,
} from "../../utils/passwordPolicy";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";

const MAX_LEN = MAX_PASSWORD_LEN;

function Field({ id, label, type = "password", value, onChange, placeholder, maxLength }) {
  return (
    <div className="mb-6">
      <label
        htmlFor={id}
        className="mb-2 block text-base font-medium text-slate-700"
      >
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={onChange}
        maxLength={maxLength}
        className="h-11 w-full rounded-xl border border-slate-300 bg-slate-100 px-4 text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:focus:bg-gray-800"
      />
    </div>
  );
}

async function safeError(res) {
  try {
    const data = await res.json();
    return data?.error || data?.message;
  } catch {
    return null;
  }
}

function ChangePasswordPage() {
  const navigate = useNavigate();
  const [current, setCurrent] = useState("");
  const [nextPw, setNextPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");

  const [showNotice, setShowNotice] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const timerRef = useRef(null);

  useBodyScrollLock(showNotice);

  const policy = useMemo(() => buildPasswordPolicy(nextPw), [nextPw]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Enter") handleSubmit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const LOGIN_ROUTE = "/";

  useEffect(() => {
    if (!showNotice) return;
    setCountdown(5);
    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timerRef.current);
          timerRef.current = null;
          navigate(LOGIN_ROUTE, { replace: true });
          return 0;
        }
        return c - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [showNotice, navigate]);

  const handleSubmit = async () => {
    if (!current.trim() || !nextPw.trim() || !confirmPw.trim()) {
      alert("Please fill in all password fields.");
      return;
    }
    if (nextPw !== confirmPw) {
      alert("The new password that was entered is different from the re-entry of the password.");
      return;
    }
    const policyChecks = [
      [!policy.minLen,  "The new password must have at least 8 characters."],
      [!policy.lower,   "The new password must have at least 1 lowercase letter."],
      [!policy.upper,   "The new password must have at least 1 uppercase letter."],
      [!policy.digit,   "The new password must have at least 1 digit."],
      [!policy.special, "The new password must have at least 1 special character."],
    ];
    const failed = policyChecks.find(([bad]) => bad);
    if (failed) { alert(failed[1]); return; }

    try {
      const res = await csrfFetch(`${API_BASE}/auth/change_password.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ currentPassword: current, newPassword: nextPw }),
      });

      if (res.ok) {
        setShowNotice(true);
      } else {
        const msg = await safeError(res);
        alert(msg || "Unable to change password at this time.");
      }
    } catch {
      alert("Network error while changing password. Please try again.");
    }
  };

  return (
    <SettingsLayout>
      <div className="mb-6 flex items-center justify-between border-b border-slate-200 pb-3 dark:border-gray-700">
        <h1 className="text-2xl font-serif font-semibold text-blue-600">
          Change Password
        </h1>
        <PageBackButton onClick={() => navigate(-1)} />
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <section>
          <Field
            id="currentPassword"
            label="Current Password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            placeholder="Enter current password"
            maxLength={MAX_LEN}
          />
          <Field
            id="newPassword"
            label="New Password"
            value={nextPw}
            onChange={(e) => setNextPw(e.target.value)}
            placeholder="Enter new password"
            maxLength={MAX_LEN}
          />
          <Field
            id="confirmPassword"
            label="Re-enter New Password"
            value={confirmPw}
            onChange={(e) => setConfirmPw(e.target.value)}
            placeholder="Re-enter new password"
            maxLength={MAX_LEN}
          />

          <button
            type="button"
            onClick={handleSubmit}
            className="mt-2 h-11 w-44 rounded-xl bg-blue-600 text-white shadow hover:bg-blue-700 dark:hover:bg-blue-900"
          >
            Confirm
          </button>
        </section>

        <section className="rounded-lg border border-slate-200 p-4">
          <h2 className="mb-3 text-lg font-serif font-semibold text-blue-600">
            Password must contain:
          </h2>
          <div className="flex flex-col gap-2">
            <PasswordRequirementRow
              ok={policy.lower}
              text="At least 1 lowercase character"
            />
            <PasswordRequirementRow
              ok={policy.upper}
              text="At least 1 uppercase character"
            />
            <PasswordRequirementRow
              ok={policy.minLen}
              text="At least 8 characters"
            />
            <PasswordRequirementRow
              ok={policy.special}
              text="At least 1 special character"
            />
            <PasswordRequirementRow ok={policy.digit} text="At least 1 digit" />
            <PasswordRequirementRow
              ok={policy.notTooLong}
              text="No more than 64 characters"
            />
          </div>
        </section>
      </div>

      {showNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 dark:bg-black/60 backdrop-blur-sm"
            aria-hidden
          />
          <div
            className="relative z-10 mx-4 w-full max-w-lg rounded-xl border border-gray-200 bg-white shadow-2xl ring-1 ring-black/5 dark:border-gray-700 dark:bg-gray-800 dark:ring-white/10"
            role="dialog"
            aria-labelledby="password-changed-title"
            aria-modal="true"
          >
            <div className="p-6">
              <h3
                id="password-changed-title"
                className="mb-3 text-center font-serif text-2xl font-semibold text-blue-600 dark:text-blue-400"
              >
                Password Changed
              </h3>
              <p className="text-center leading-relaxed text-gray-700 dark:text-gray-300">
                Your password was changed successfully.
                <br />
                You will be taken to our log in page in{" "}
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  {countdown}
                </span>{" "}
                seconds.
              </p>
            </div>
          </div>
        </div>
      )}
    </SettingsLayout>
  );
}

export default ChangePasswordPage;
