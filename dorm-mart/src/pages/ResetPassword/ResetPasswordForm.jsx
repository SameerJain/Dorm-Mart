import { useNavigate } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";

const NAV_BLUE = "#2563EB";
const MAX_LEN = 64;

const hasLower = (s) => /[a-z]/.test(s);
const hasUpper = (s) => /[A-Z]/.test(s);
const hasDigit = (s) => /\d/.test(s);
const hasSpecial = (s) => /[^A-Za-z0-9]/.test(s);

function RequirementRow({ ok, text }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="inline-flex h-2.5 w-2.5 rounded-full" style={{ backgroundColor: ok ? "#22c55e" : "#ef4444" }} />
      <span className={ok ? "text-green-700" : "text-red-700"}>{text}</span>
    </div>
  );
}

function Field({ id, label, type = "password", value, onChange, placeholder, disabled = false }) {
  return (
    <div className="mb-6">
      <label htmlFor={id} className="mb-2 block text-base font-medium text-slate-700">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={onChange}
        disabled={disabled}
        className={`h-11 w-full rounded-xl border px-4 text-slate-900 outline-none focus:ring-2 ${disabled
            ? 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
            : 'border-slate-300 bg-slate-100 focus:bg-white'
          }`}
        style={{ focusRingColor: NAV_BLUE }}
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

function ResetPasswordForm({ token }) {
  const navigate = useNavigate();

  // Form state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Token validation state
  const [isTokenValid, setIsTokenValid] = useState(true);
  const [tokenError, setTokenError] = useState("");
  const [isVerifyingToken, setIsVerifyingToken] = useState(true);

  // Error handling state
  const [submitError, setSubmitError] = useState("");
  const [passwordMismatchError, setPasswordMismatchError] = useState("");

  // Success modal state
  const [showNotice, setShowNotice] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const timerRef = useRef(null);

  // Comprehensive protection: token validation, back button prevention, and session tracking
  useEffect(() => {
    // Check if user has already visited this page (prevent back navigation)
    if (sessionStorage.getItem('resetPageVisited')) {
      navigate('/login?error=reset_link_expired', { replace: true });
      return;
    }

    // Mark that user has visited this page
    sessionStorage.setItem('resetPageVisited', 'true');

    // Handle missing token
    if (!token) {
      navigate('/login?error=invalid_reset_link', { replace: true });
      return;
    }

    // Verify token is still valid using existing endpoint
    const verifyToken = async () => {
      try {
        const res = await fetch(`api/redirects/handle_password_reset_token_redirect.php?token=${encodeURIComponent(token)}`);
        if (!res.ok) {
          setIsTokenValid(false);
          setTokenError("This reset link has expired or is invalid. Please request a new password reset.");
        }
      } catch {
        setIsTokenValid(false);
        setTokenError("Unable to verify reset link. Please try again or request a new password reset.");
      } finally {
        setIsVerifyingToken(false);
      }
    };

    verifyToken();

    // Prevent back button navigation with visual feedback
    const handlePopState = () => {
      // Show a brief warning before redirecting
      const warning = document.createElement('div');
      warning.className = 'fixed top-4 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
      warning.textContent = '⚠️ Reset link expired - redirecting to login...';
      document.body.appendChild(warning);

      setTimeout(() => {
        document.body.removeChild(warning);
        navigate('/login?error=reset_link_expired', { replace: true });
      }, 2000);
    };

    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', handlePopState);

    return () => window.removeEventListener('popstate', handlePopState);
  }, [token, navigate]);

  // Prevent back navigation after successful submission
  useEffect(() => {
    if (showNotice) window.history.replaceState(null, '', window.location.href);
  }, [showNotice]);

  const policy = useMemo(
    () => ({
      minLen: newPassword.length >= 8,
      lower: hasLower(newPassword),
      upper: hasUpper(newPassword),
      digit: hasDigit(newPassword),
      special: hasSpecial(newPassword),
      notTooLong: newPassword.length <= MAX_LEN,
    }),
    [newPassword]
  );

  const enforceMax = (setter) => (e) => {
    const v = e.target.value;
    if (v.length > MAX_LEN) alert("Entered password is too long. Maximum length is 64 characters.");
    setter(v);
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Enter") handleSubmit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const LOGIN_ROUTE = "/";

  // Start 5s countdown only after success modal shows
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
    // Clear previous errors
    setSubmitError("");
    setPasswordMismatchError("");

    // Validate token
    if (!token) {
      setSubmitError("Invalid reset link. Please request a new password reset.");
      return;
    }

    // Validate password presence
    if (!newPassword || !confirmPassword) {
      setSubmitError("Please enter a password in both fields.");
      return;
    }

    // Test 3: Check password mismatch
    if (newPassword !== confirmPassword) {
      setPasswordMismatchError("The new password and re-enter new password must match.");
      return;
    }

    // Test 2: Check password requirements
    if (newPassword.length > MAX_LEN || confirmPassword.length > MAX_LEN) {
      setSubmitError("Entered password is too long. Maximum length is 64 characters.");
      return;
    }
    if (newPassword.length < 8) {
      setSubmitError("The new password must have at least 8 characters.");
      return;
    }
    if (!hasLower(newPassword)) {
      setSubmitError("The new password must have at least 1 lowercase letter.");
      return;
    }
    if (!hasUpper(newPassword)) {
      setSubmitError("The new password must have at least 1 uppercase letter.");
      return;
    }
    if (!hasDigit(newPassword)) {
      setSubmitError("The new password must have at least 1 digit.");
      return;
    }
    if (!hasSpecial(newPassword)) {
      setSubmitError("The new password must have at least 1 special character.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("api/auth/reset-password.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: token,
          newPassword: newPassword
        }),
      });

      if (res.ok) {
        setShowNotice(true);
      } else {
        const msg = await safeError(res);
        // Test 1: Handle invalid token (401/403 errors)
        if (res.status === 401 || res.status === 403 || (msg && msg.includes('Invalid or expired'))) {
          setSubmitError("Updating password failed. Please try again with a new link.");
        } else {
          setSubmitError(msg || "Something went wrong. Please try again later.");
        }
      }
    } catch {
      // Test 5: Handle request failure
      setSubmitError("Something went wrong. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#2563EB' }}>
      <div className="w-full max-w-4xl mx-auto">
        <div className="bg-white rounded-xl shadow-2xl p-4 sm:p-8 min-h-[600px] flex flex-col">
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 pb-3 gap-4">
            <h1 className="text-xl sm:text-2xl font-serif font-semibold" style={{ color: NAV_BLUE }}>
              Reset Password
            </h1>
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="rounded-lg border border-slate-300 px-3 py-1 text-sm hover:bg-slate-50 self-start sm:self-auto"
              style={{ color: NAV_BLUE }}
              aria-label="Go to login"
            >
              ← Back to Login
            </button>
          </div>

          <div className="flex-1 grid grid-cols-1 gap-6 lg:gap-8 lg:grid-cols-2">
            <section className="flex flex-col justify-center">
              {isVerifyingToken && (
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-blue-700">Verifying reset link...</p>
                    </div>
                  </div>
                </div>
              )}

              {isLoading && (
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-blue-700">Resetting your password...</p>
                    </div>
                  </div>
                </div>
              )}

              {!isTokenValid && !isVerifyingToken && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-red-800">Reset Link Expired</h3>
                      <p className="mt-1 text-sm text-red-700">{tokenError}</p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <button
                      onClick={() => navigate('/forgot-password')}
                      className="text-sm bg-red-100 hover:bg-red-200 text-red-800 px-3 py-2 rounded-md transition-colors"
                    >
                      Request New Reset Link
                    </button>
                    <button
                      onClick={() => navigate('/login')}
                      className="ml-3 text-sm bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-2 rounded-md transition-colors"
                    >
                      Back to Login
                    </button>
                  </div>
                </div>
              )}

              {/* Test 1: Invalid token error */}
              {submitError && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-red-700">{submitError}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Test 3: Password mismatch error */}
              {passwordMismatchError && (
                <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-yellow-700">{passwordMismatchError}</p>
                    </div>
                  </div>
                </div>
              )}

              <Field
                id="newPassword"
                label="New Password"
                value={newPassword}
                onChange={enforceMax(setNewPassword)}
                placeholder="Enter new password"
                disabled={!isTokenValid || isVerifyingToken}
              />
              <Field
                id="confirmPassword"
                label="Re-enter New Password"
                value={confirmPassword}
                onChange={enforceMax(setConfirmPassword)}
                placeholder="Re-enter new password"
                disabled={!isTokenValid || isVerifyingToken}
              />

              <button
                type="button"
                onClick={handleSubmit}
                disabled={isLoading || !isTokenValid || isVerifyingToken}
                className="mt-6 h-12 w-full sm:w-48 rounded-xl text-white shadow disabled:opacity-50 disabled:cursor-not-allowed text-lg font-medium"
                style={{ backgroundColor: NAV_BLUE }}
              >
                {isLoading ? 'Resetting...' : isVerifyingToken ? 'Verifying...' : 'Reset Password'}
              </button>
            </section>

            <section className="rounded-lg border border-slate-200 p-4 sm:p-6 flex flex-col justify-center">
              <h2 className="mb-4 text-lg sm:text-xl font-serif font-semibold" style={{ color: NAV_BLUE }}>
                Password Requirements:
              </h2>
              <div className="flex flex-col gap-3">
                <RequirementRow ok={policy.lower} text="At least 1 lowercase character" />
                <RequirementRow ok={policy.upper} text="At least 1 uppercase character" />
                <RequirementRow ok={policy.minLen} text="At least 8 characters" />
                <RequirementRow ok={policy.special} text="At least 1 special character" />
                <RequirementRow ok={policy.digit} text="At least 1 digit" />
                <RequirementRow ok={policy.notTooLong} text="No more than 64 characters" />
              </div>
            </section>
          </div>

          {/* Success Notice Modal */}
          {showNotice && (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              {/* backdrop */}
              <div className="absolute inset-0 bg-black bg-opacity-50" />
              {/* card */}
              <div
                className="relative z-10 w-full max-w-lg mx-4 rounded-xl shadow-2xl border border-white/10"
                style={{ backgroundColor: "#3d3eb5" }}
              >
                <div className="p-6">
                  <h3 className="text-2xl font-serif text-white mb-3 text-center">Password Reset</h3>
                  <p className="text-white/90 text-center leading-relaxed">
                    Your password was reset successfully.
                    <br />
                    You will be taken to our log in page in{" "}
                    <span className="font-semibold">{countdown}</span> seconds.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ResetPasswordForm;
