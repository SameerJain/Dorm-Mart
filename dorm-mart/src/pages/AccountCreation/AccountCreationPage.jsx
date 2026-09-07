import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";
import PreLoginBranding from "../../components/PreLoginBranding";
import PreLoginNavLinks from "../../components/PreLoginNavLinks";
import { useEmailPolicy } from "../../hooks/useEmailPolicy";
import {
  ACCOUNT_REQUEST_RATE_LIMIT_MESSAGE,
  applyAccountRequestLockout,
  consumeAccountRequestAttempt,
  getAccountRequestRateLimit,
  submitAccountRequest,
} from "./accountCreationRequest";

const MAX_GRADUATION_YEARS_AHEAD = 6;
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function isValidGraduationMonth(month, year, currentYear, currentMonth, maxYear) {
  if (!Number.isInteger(month) || month < 1 || month > 12) return false;
  if (year === currentYear) return month >= currentMonth;
  if (year === maxYear) return month <= currentMonth;
  return year > currentYear && year < maxYear;
}

function FieldError({ children, className = "" }) {
  if (!children) return null;
  return (
    <p
      className={`mt-0.5 text-[11px] font-medium leading-tight text-red-500 sm:text-xs ${className}`.trim()}
    >
      {children}
    </p>
  );
}

function CreateAccountPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [formData, setFormData] = useState(() =>
    location.state?.accountDraft || {
      firstName: "",
      lastName: "",
      gradMonth: "",
      gradYear: "",
      email: "",
      terms: false,
      promos: false,
    },
  );
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showNotice, setShowNotice] = useState(false);
  const [rateLimitBlockedUntil, setRateLimitBlockedUntil] = useState(
    () => getAccountRequestRateLimit().blockedUntil,
  );
  const { allowAllEmails, emailPolicyLoading } = useEmailPolicy();
  const rateLimited = rateLimitBlockedUntil > Date.now();
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  const maxGraduationYear = currentYear + MAX_GRADUATION_YEARS_AHEAD;
  const graduationYears = Array.from(
    { length: MAX_GRADUATION_YEARS_AHEAD + 1 },
    (_, index) => currentYear + index,
  );
  const selectedGraduationYear = Number(formData.gradYear);
  const graduationMonths = MONTH_NAMES.map((name, index) => ({
    name,
    value: index + 1,
  })).filter(({ value }) =>
    !formData.gradYear ||
    isValidGraduationMonth(
      value,
      selectedGraduationYear,
      currentYear,
      currentMonth,
      maxGraduationYear,
    ),
  );

  useBodyScrollLock(showNotice);

  useEffect(() => {
    const remaining = rateLimitBlockedUntil - Date.now();
    if (remaining <= 0) return undefined;
    const timer = window.setTimeout(() => {
      setRateLimitBlockedUntil(0);
      setErrors((current) => {
        if (current.submit !== ACCOUNT_REQUEST_RATE_LIMIT_MESSAGE) return current;
        const next = { ...current };
        delete next.submit;
        return next;
      });
    }, remaining);
    return () => window.clearTimeout(timer);
  }, [rateLimitBlockedUntil]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    // Enforce hard caps at input-time
    let nextValue = type === "checkbox" ? checked : value;
    if (name === "firstName" || name === "lastName") {
      // Only allow letters (including spaces and hyphens for names like "Mary-Jane" or "Van Der Berg")
      // Remove any non-letter characters except spaces and hyphens
      nextValue = String(nextValue).replace(/[^a-zA-Z\s-]/g, "");
      nextValue = nextValue.slice(0, 30);
    }
    if (name === "email") {
      nextValue = String(nextValue).slice(0, 255);
    }
    if (name === "gradMonth") {
      nextValue = String(nextValue).replace(/\D/g, "").slice(0, 2);
    }
    if (name === "gradYear") {
      nextValue = String(nextValue).replace(/\D/g, "").slice(0, 4);
    }

    setFormData((prev) => ({
      ...prev,
      [name]: nextValue,
      ...(name === "gradYear" &&
      prev.gradMonth &&
      !isValidGraduationMonth(
        Number(prev.gradMonth),
        Number(nextValue),
        currentYear,
        currentMonth,
        maxGraduationYear,
      )
        ? { gradMonth: "" }
        : {}),
    }));
  };

  const validate = () => {
    const newErrors = {};

    const first = formData.firstName.trim();
    const last = formData.lastName.trim();
    const email = formData.email.trim();

    if (!first) newErrors.firstName = "First name is required";
    else if (!/^[a-zA-Z\s-]+$/.test(first)) {
      newErrors.firstName =
        "First name can only contain letters, spaces, and hyphens";
    } else if (first.length > 30)
      newErrors.firstName = "First name must be 30 characters or fewer";

    if (!last) newErrors.lastName = "Last name is required";
    else if (!/^[a-zA-Z\s-]+$/.test(last)) {
      newErrors.lastName =
        "Last name can only contain letters, spaces, and hyphens";
    } else if (last.length > 30)
      newErrors.lastName = "Last name must be 30 characters or fewer";

    if (!formData.gradMonth || !formData.gradYear) {
      newErrors.gradDate = "Graduation month and year are required";
    } else {
      const month = parseInt(formData.gradMonth, 10);
      const year = parseInt(formData.gradYear, 10);

      if (Number.isNaN(month) || month < 1 || month > 12) {
        newErrors.gradDate = "Invalid month";
      } else if (Number.isNaN(year) || year < 1900) {
        newErrors.gradDate = "Invalid year";
      } else {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const gradDate = new Date(year, month - 1, 1);
        const maxDate = new Date(
          now.getFullYear() + MAX_GRADUATION_YEARS_AHEAD,
          now.getMonth(),
          1,
        );
        if (gradDate < new Date(now.getFullYear(), now.getMonth(), 1))
          newErrors.gradDate = "Graduation date cannot be in the past";
        if (gradDate > maxDate)
          newErrors.gradDate = "Graduation date must be within 6 years";
      }
    }

    if (!email) {
      newErrors.email = "Email is required";
    } else if (email.length > 255) {
      newErrors.email = "Email must be 255 characters or fewer";
    } else if (!emailPolicyLoading) {
      // Only validate domain if policy is loaded
      if (!allowAllEmails && !email.toLowerCase().endsWith("@buffalo.edu")) {
        newErrors.email = "Email must be a buffalo.edu address";
      } else if (allowAllEmails) {
        // Basic email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          newErrors.email = "Please enter a valid email address";
        }
      }
    }

    if (!formData.terms) newErrors.terms = "You must agree to the terms";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    const clientRateLimit = consumeAccountRequestAttempt();
    if (!clientRateLimit.allowed) {
      setRateLimitBlockedUntil(clientRateLimit.blockedUntil);
      setErrors({ submit: ACCOUNT_REQUEST_RATE_LIMIT_MESSAGE });
      return;
    }
    setRateLimitBlockedUntil(clientRateLimit.blockedUntil);

    setLoading(true);
    try {
      const result = await submitAccountRequest(formData);
      if (!result.accepted) {
        if (result.rateLimited) {
          setRateLimitBlockedUntil(
            applyAccountRequestLockout(result.retryAfterSeconds),
          );
        }
        setErrors({ submit: result.error });
        return;
      }

      setShowNotice(true);
    } catch {
      setErrors({
        submit: "Unable to reach the server. Please check your connection and try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-dvh flex flex-col lg:flex-row pre-login-bg overflow-hidden">
      <PreLoginBranding />

      {/* Right side - Create Account form (full width on mobile/tablet, 50% on desktop) */}
      <div className="w-full lg:w-1/2 flex flex-col items-center justify-start md:justify-center lg:justify-center p-4 sm:p-6 md:p-6 lg:px-8 xl:px-8 pt-6 sm:pt-8 md:pt-16 md:pb-8 lg:py-6 xl:py-8 pb-[max(1.5rem,env(safe-area-inset-bottom))] h-dvh min-h-0 overflow-y-auto lg:overflow-y-hidden pre-login-bg relative">
        {/* Mobile branding header (visible only on mobile/tablet) */}
        <div className="lg:hidden mb-4 sm:mb-6 md:mb-8 text-center w-full relative z-10">
          <h1 className="text-5xl sm:text-6xl md:text-8xl font-serif text-gray-800 mb-3 leading-tight">
            Dorm Mart
          </h1>
          <h2 className="text-xl sm:text-2xl md:text-4xl font-light text-gray-600 opacity-90 leading-relaxed">
            Wastage, who?
          </h2>
        </div>
        <div className="w-full max-w-sm sm:max-w-md md:max-w-xl lg:max-w-md relative z-10">
          <div className="px-4 sm:px-6 md:px-8 lg:px-6 py-2.5 sm:py-4 md:py-6 lg:py-3 rounded-lg relative bg-blue-600">
            {/* Torn paper effect */}
            <div
              className="absolute inset-0 rounded-lg bg-blue-600"
              style={{
                clipPath:
                  "polygon(0 0, 100% 0, 100% 85%, 95% 90%, 100% 95%, 100% 100%, 0 100%)",
              }}
            />

            <div className="relative z-10">
              {/* Header with dot */}
              <div className="text-center mb-2.5 sm:mb-4 md:mb-5 lg:mb-2.5">
                <div className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 bg-black rounded-full mx-auto mb-2 sm:mb-3 md:mb-3" />
                <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-3xl font-serif text-white leading-tight">
                  Create Account
                </h2>
              </div>

              {/* Form - Improved spacing and touch targets */}
              <form
                onSubmit={handleSubmit}
                className={
                  Object.keys(errors).length > 0
                    ? "space-y-1.5 sm:space-y-2 md:space-y-2 lg:space-y-1 xl:space-y-1.5"
                    : "space-y-3 sm:space-y-4 md:space-y-4 lg:space-y-2.5 xl:space-y-3"
                }
              >
                {/* First Name */}
                <div>
                  <label className="block text-sm sm:text-base md:text-lg lg:text-base font-semibold text-gray-200 mb-2 sm:mb-2.5 md:mb-2">
                    First Name
                  </label>
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    maxLength={30}
                    className="w-full min-h-[44px] px-4 sm:px-5 md:px-4 py-3 sm:py-3.5 md:py-5 lg:py-3 bg-white rounded-lg border-2 border-gray-300 focus:outline-none focus:ring-4 focus:ring-blue-400/30 focus:border-blue-400 transition-all duration-200 shadow-sm hover:shadow-md focus:shadow-lg text-base sm:text-lg md:text-xl lg:text-base"
                  />
                  <FieldError>{errors.firstName}</FieldError>
                </div>

                {/* Last Name */}
                <div>
                  <label className="block text-sm sm:text-base md:text-lg lg:text-base font-semibold text-gray-200 mb-2 sm:mb-2.5 md:mb-2">
                    Last Name
                  </label>
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    maxLength={30}
                    className="w-full min-h-[44px] px-4 sm:px-5 md:px-4 py-3 sm:py-3.5 md:py-5 lg:py-3 bg-white rounded-lg border-2 border-gray-300 focus:outline-none focus:ring-4 focus:ring-blue-400/30 focus:border-blue-400 transition-all duration-200 shadow-sm hover:shadow-md focus:shadow-lg text-base sm:text-lg md:text-xl lg:text-base"
                  />
                  <FieldError>{errors.lastName}</FieldError>
                </div>

                {/* Graduation Date */}
                <div>
                  <label className="block text-sm sm:text-base md:text-lg lg:text-base font-semibold text-gray-200 mb-2 sm:mb-2.5 md:mb-2">
                    Graduation Date (Month / Year)
                  </label>
                  <div className="flex gap-3 sm:gap-4 md:gap-3">
                    <select
                      name="gradMonth"
                      value={formData.gradMonth}
                      onChange={handleChange}
                      className="w-1/2 min-h-[44px] px-4 sm:px-5 md:px-4 py-3 sm:py-3.5 md:py-5 lg:py-3 bg-white rounded-lg border-2 border-gray-300 focus:outline-none focus:ring-4 focus:ring-blue-400/30 focus:border-blue-400 transition-all duration-200 shadow-sm hover:shadow-md focus:shadow-lg text-base sm:text-lg md:text-xl lg:text-base cursor-pointer"
                    >
                      <option value="">Month</option>
                      {graduationMonths.map(({ name, value }) => (
                        <option key={value} value={value}>
                          {name}
                        </option>
                      ))}
                    </select>
                    <select
                      name="gradYear"
                      value={formData.gradYear}
                      onChange={handleChange}
                      className="w-1/2 min-h-[44px] px-4 sm:px-5 md:px-4 py-3 sm:py-3.5 md:py-5 lg:py-3 bg-white rounded-lg border-2 border-gray-300 focus:outline-none focus:ring-4 focus:ring-blue-400/30 focus:border-blue-400 transition-all duration-200 shadow-sm hover:shadow-md focus:shadow-lg text-base sm:text-lg md:text-xl lg:text-base cursor-pointer"
                    >
                      <option value="">Year</option>
                      {graduationYears.map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                  </div>
                  <FieldError>{errors.gradDate}</FieldError>
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm sm:text-base md:text-lg lg:text-base font-semibold text-gray-200 mb-2 sm:mb-2.5 md:mb-2">
                    University Email Address
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    maxLength={255}
                    className="w-full min-h-[44px] px-4 sm:px-5 md:px-4 py-3 sm:py-3.5 md:py-5 lg:py-3 bg-white rounded-lg border-2 border-gray-300 focus:outline-none focus:ring-4 focus:ring-blue-400/30 focus:border-blue-400 transition-all duration-200 shadow-sm hover:shadow-md focus:shadow-lg text-base sm:text-lg md:text-xl lg:text-base"
                  />
                  <FieldError>{errors.email}</FieldError>
                </div>

                {/* Checkboxes - Improved touch targets */}
                <div className="space-y-3 sm:space-y-4 md:space-y-3 lg:space-y-2.5">
                  <label className="flex items-start text-gray-100 min-h-[44px] py-2">
                    <input
                      type="checkbox"
                      name="terms"
                      checked={formData.terms}
                      onChange={handleChange}
                      className="mt-1 mr-3 h-5 w-5 sm:h-6 sm:w-6 md:h-6 md:w-6 lg:h-5 lg:w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 flex-shrink-0"
                    />
                    <span className="select-none text-sm sm:text-base md:text-lg lg:text-base leading-relaxed pt-0.5">
                      I agree to the{" "}
                      <button
                        type="button"
                        className="underline decoration-white/70 hover:decoration-white hover:text-blue-200"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          navigate("/terms-of-service", {
                            state: { from: "/create-account", accountDraft: formData },
                          });
                        }}
                      >
                        Terms & Conditions
                      </button>{" "}
                      and{" "}
                      <button
                        type="button"
                        className="underline decoration-white/70 hover:decoration-white hover:text-blue-200"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          navigate("/privacy-policy", {
                            state: { from: "/create-account", accountDraft: formData },
                          });
                        }}
                      >
                        Privacy Policy
                      </button>
                    </span>
                  </label>
                  <FieldError className="ml-8">{errors.terms}</FieldError>

                  <label className="flex items-start text-gray-100 min-h-[44px] py-2">
                    <input
                      type="checkbox"
                      name="promos"
                      checked={formData.promos}
                      onChange={handleChange}
                      className="mt-1 mr-3 h-5 w-5 sm:h-6 sm:w-6 md:h-6 md:w-6 lg:h-5 lg:w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 flex-shrink-0"
                    />
                    <span className="select-none text-sm sm:text-base md:text-lg lg:text-base leading-relaxed pt-0.5">
                      I want to receive promotional news on my email
                    </span>
                  </label>
                </div>
                <FieldError>
                  {errors.submit ||
                    (rateLimited ? ACCOUNT_REQUEST_RATE_LIMIT_MESSAGE : "")}
                </FieldError>

                {/* Confirm button - Minimum 44px height for touch targets */}
                <button
                  type="submit"
                  disabled={loading || rateLimited}
                  className={`w-full min-h-[44px] text-white py-3 sm:py-3.5 md:py-5 lg:py-3 rounded-lg flex items-center justify-center space-x-2 transition-all duration-200 font-medium text-base sm:text-lg md:text-xl lg:text-base active:scale-95
                    ${loading || rateLimited ? "bg-sky-300 cursor-not-allowed" : "bg-sky-500 hover:bg-sky-600 hover:scale-105 hover:shadow-lg"}
                  `}
                >
                  <span>
                    {loading
                      ? "Submitting…"
                      : rateLimited
                        ? "Try again later"
                        : "Confirm"}
                  </span>
                  {!loading && !rateLimited && (
                    <svg
                      className="w-5 h-5"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </button>
              </form>

              {/* Links - Improved touch targets and spacing */}
              <div className="mt-4 sm:mt-6 md:mt-5 lg:mt-3 mb-2.5 sm:mb-4 md:mb-3 lg:mb-2.5 text-center">
                <PreLoginNavLinks
                  className="text-sm sm:text-base md:text-lg lg:text-base"
                  hoverClassName="hover:text-blue-300"
                  links={[
                    { label: "Already Have An Account? Log In", to: "/login" },
                    { label: "Forgot Password?", to: "/forgot-password" },
                  ]}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Notice Modal - Improved mobile responsiveness */}
      {showNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          {/* backdrop */}
          <div
            className="absolute inset-0 bg-black bg-opacity-50"
            onClick={() => setShowNotice(false)}
          />
          {/* card */}
          <div className="relative z-10 w-full max-w-lg rounded-xl shadow-2xl border border-white/10 bg-blue-600">
            <div className="p-6 sm:p-8">
              <h3 className="text-2xl sm:text-3xl font-serif text-white mb-4 sm:mb-5 text-center leading-tight">
                Check Your Email
              </h3>
              <p className="text-white/90 text-center leading-relaxed text-sm sm:text-base mb-6 sm:mb-8">
                If an account using the email does not already exist, a
                temporary password has been sent to the email. Please check
                your spam folder.
              </p>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-4">
                <button
                  onClick={() => {
                    setShowNotice(false);
                    navigate("/login");
                  }}
                  className="min-h-[44px] px-6 py-3 sm:py-3.5 rounded-lg bg-sky-500 hover:bg-sky-600 text-white transition-colors font-medium text-base sm:text-lg active:scale-95"
                >
                  Go to Login
                </button>
                <button
                  onClick={() => setShowNotice(false)}
                  className="min-h-[44px] px-6 py-3 sm:py-3.5 rounded-lg bg-white/20 hover:bg-white/30 text-white transition-colors font-medium text-base sm:text-lg active:scale-95"
                >
                  Stay Here
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CreateAccountPage;
