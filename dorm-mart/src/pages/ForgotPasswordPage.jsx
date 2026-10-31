import { useNavigate } from "react-router-dom";
import { useState } from "react";
import logger from "../utils/logger";
import PreLoginBranding from "../components/PreLoginBranding";
import PreLoginNavLinks from "../components/PreLoginNavLinks";
import { API_BASE } from "../utils/apiConfig";
import { useEmailPolicy } from "../hooks/useEmailPolicy";
import { useSubmitLock } from "../hooks/useSubmitLock";

function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { allowAllEmails, emailPolicyLoading } = useEmailPolicy();
  const runExclusive = useSubmitLock();
  async function sendForgotPasswordRequest(email, signal) {
    const r = await fetch(`${API_BASE}/auth/forgot_password.php`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
      signal,
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }

  const handleForgotPasswordRequest = async () => {
    setError("");

    const valid = emailValidation(email);
    if (!valid) {
      if (!emailPolicyLoading && !allowAllEmails) {
        setError("Email must be a buffalo.edu address");
      } else {
        setError("Please enter a valid email address");
      }
      return;
    }

    setIsLoading(true);

    try {
      const ac = new AbortController();
      await sendForgotPasswordRequest(email, ac.signal);

      // The API returns the same accepted response for every valid-looking
      // address, so this does not disclose whether an account exists.
      setError("");

      setTimeout(() => {
        setIsLoading(false);
        navigate("/forgot-password/confirmation");
      }, 2000);
    } catch (err) {
      logger.error(err);
      setIsLoading(false);
      setError("Unable to reach the server. Please check your connection and try again.");
    }
  };

  function emailValidation(email) {
    const trimmed = email.trim();

    if (trimmed.length > 255) return false;

    if (!emailPolicyLoading) {
      if (!allowAllEmails) {
        const pattern = /^[^@\s]+@buffalo\.edu$/i;
        if (!pattern.test(trimmed)) return false;
      } else {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(trimmed)) return false;
      }
    }

    const localPart = trimmed.split("@")[0];

    if (/^\d+$/.test(localPart)) return false;

    return true;
  }

  return (
    <div className="h-dvh flex flex-col lg:flex-row pre-login-bg overflow-hidden">
      <PreLoginBranding />

      <div className="w-full lg:w-1/2 flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 py-8 sm:py-12 md:pt-16 md:pb-8 lg:py-8 pb-[max(2rem,env(safe-area-inset-bottom))] h-dvh pre-login-bg relative overflow-y-auto lg:overflow-hidden">
        <div className="lg:hidden mb-6 sm:mb-8 md:mb-10 text-center relative z-10">
          <h1 className="text-5xl sm:text-6xl md:text-8xl font-serif text-gray-800 mb-3 leading-tight">
            Dorm Mart
          </h1>
          <h2 className="text-xl sm:text-2xl md:text-4xl font-light text-gray-600 opacity-90 leading-relaxed">
            Wastage, who?
          </h2>
        </div>
        <div className="w-full max-w-md md:max-w-xl px-2 sm:px-0 relative z-10">
          <div className="p-4 sm:p-6 md:p-10 rounded-lg relative bg-blue-600">
            <div
              className="absolute inset-0 rounded-lg bg-blue-600"
              style={{
                clipPath:
                  "polygon(0 0, 100% 0, 100% 85%, 95% 90%, 100% 95%, 100% 100%, 0 100%)",
              }}
            ></div>

            <div className="relative z-10">
              <div className="text-center mb-6 sm:mb-8 md:mb-10">
                <div className="w-3 h-3 sm:w-3.5 sm:h-3.5 bg-black rounded-full mx-auto mb-4 sm:mb-5"></div>
                <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif text-white leading-tight">
                  Forgot Password?
                </h2>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  runExclusive(handleForgotPasswordRequest);
                }}
                noValidate
                className="space-y-4 sm:space-y-5 md:space-y-6"
              >
                <div>
                  <label className="block text-sm sm:text-base md:text-lg font-semibold text-gray-300 mb-2 sm:mb-2.5">
                    University Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    maxLength={255}
                    required
                    className="w-full min-h-[44px] px-4 sm:px-5 py-3 sm:py-3.5 md:py-5 text-base sm:text-lg md:text-xl bg-white rounded-lg border-2 border-gray-300 focus:outline-none focus:ring-4 focus:ring-blue-400/30 focus:border-blue-400 transition-all duration-200 shadow-sm hover:shadow-md focus:shadow-lg"
                  />
                </div>
                {error && (
                  <p className="text-sm sm:text-base font-medium text-center text-red-500 px-2 leading-relaxed">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full min-h-[44px] bg-sky-500 hover:bg-sky-600 text-white py-3 sm:py-3.5 md:py-5 px-5 rounded-lg flex items-center justify-center space-x-2 transition-all duration-200 hover:scale-105 hover:shadow-lg font-medium text-base sm:text-lg md:text-xl active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  {isLoading ? (
                    <svg
                      className="animate-spin h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                      ></path>
                    </svg>
                  ) : (
                    <>
                      <span className="whitespace-nowrap">
                        Send password reset link
                      </span>
                      <svg
                        className="w-5 h-5 flex-shrink-0"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </>
                  )}
                </button>
              </form>

              <div className="mt-6 sm:mt-8 text-center px-2">
                <PreLoginNavLinks
                  className="text-sm sm:text-base md:text-lg"
                  buttonClassName="whitespace-nowrap"
                  links={[
                    { label: "Create Account", to: "/create-account" },
                    { label: "Go To Login", to: "/login" },
                  ]}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ForgotPasswordPage;
