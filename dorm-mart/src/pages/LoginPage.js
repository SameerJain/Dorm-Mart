import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import PreLoginBranding from "../components/PreLoginBranding";
import { applyThemeToDOM, THEME_PENDING_KEY } from "../utils/load_theme.js";

const API_BASE = process.env.REACT_APP_API_BASE || "/api";

function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [allowAllEmails, setAllowAllEmails] = useState(false);
  const [emailPolicyLoading, setEmailPolicyLoading] = useState(true);

  // Handle URL parameters
  useEffect(() => {
    const urlError = searchParams.get('error');
    const urlMessage = searchParams.get('message');
    
    if (urlError === 'reset_link_expired') {
      setError("Password reset link has expired. Please request a new one.");
    } else if (urlError === 'invalid_reset_link') {
      setError("Invalid password reset link. Please use the link from your email.");
    }
    
    if (urlMessage === 'password_reset_success') {
      setSuccess("Password has been reset successfully. You can now log in with your new password.");
    }
  }, [searchParams]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(""); // Clear previous errors
    setLoading(true);

    // Validate input lengths FIRST (prevent excessively large inputs)
    if (email.length > 255 || password.length > 64) {
      setError("Username or password is too large");
      setLoading(false);
      return;
    }

    // XSS PROTECTION: Check for XSS patterns in email field
    const xssPatterns = [
      /<script/i,
      /javascript:/i,
      /onerror=/i,
      /onload=/i,
      /onclick=/i,
      /<iframe/i,
      /<object/i,
      /<embed/i,
      /<img[^>]*on/i,
      /<svg[^>]*on/i,
      /vbscript:/i
    ];
    
    const emailTrimmed = email.trim();
    if (xssPatterns.some(pattern => pattern.test(emailTrimmed))) {
      setError("Invalid email format");
      setLoading(false);
      return;
    }

    // Frontend validation
    if (emailTrimmed === "" && password.trim() === "") {
      setError("Missing required fields");
      setLoading(false);
      return;
    }

    if (emailTrimmed === "") {
      setError("Please enter your email address");
      setLoading(false);
      return;
    }

    // Email validation based on ALLOW_ALL_EMAILS flag (for UX, but backend accepts any valid email)
    if (!emailPolicyLoading && !allowAllEmails && !emailTrimmed.toLowerCase().endsWith("@buffalo.edu")) {
      setError("Email must be a buffalo.edu address");
      setLoading(false);
      return;
    }

    // Basic email format validation if allowAllEmails is true
    if (!emailPolicyLoading && allowAllEmails) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(emailTrimmed)) {
        setError("Please enter a valid email address");
        setLoading(false);
        return;
      }
    }

    if (password.trim() === "") {
      setError("Please enter your password");
      setLoading(false);
      return;
    }

    try {
      // Call backend login API
      const response = await fetch(
        `${process.env.REACT_APP_API_BASE}/auth/login.php`,
        {
          method: "POST",
          credentials: "include", // Important: allows cookies to be set
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: email.trim(),
            password: password,
          }),
        }
      );

      // Check if response is ok before parsing JSON
      if (!response.ok) {
        // Try to get error message from response
        let errorMessage = "Network error. Please try again.";
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch (e) {
          // Response isn't JSON, use status text
          errorMessage = `Server error (${response.status}): ${response.statusText}`;
        }
        setError(errorMessage);
        setLoading(false);
        return;
      }

      const data = await response.json();

      if (data.ok) {
        // Auth token is now set server-side as httpOnly cookie
        
        // Apply theme immediately after successful login (class, cache, theme-color, color-scheme)
        if (data.theme === 'dark' || data.theme === 'light') {
          try {
            localStorage.removeItem(THEME_PENDING_KEY);
          } catch (_) {}
          applyThemeToDOM(data.theme);

          // Also save per-user key for immediate access
          try {
            const meRes = await fetch(`${API_BASE}/auth/me.php`, { 
              method: 'GET', 
              credentials: 'include' 
            });
            if (meRes.ok) {
              const meJson = await meRes.json();
              const userId = meJson.user_id;
              if (userId) {
                const userThemeKey = `userTheme_${userId}`;
                localStorage.setItem(userThemeKey, data.theme);
              }
            }
          } catch (e) {
            // User not authenticated or error - continue anyway
          }
        }
        
        // Navigate to the main app
        navigate("/app");
      } else {
        // Show error from backend, with improved messaging
        const backendError = data.error || "Login failed";
        let userFriendlyError = backendError;
        
        // Map backend errors to more user-friendly messages
        if (backendError === "Invalid email format") {
          userFriendlyError = "Please enter a valid email address";
        } else if (backendError === "Invalid credentials") {
          userFriendlyError = "Invalid email or password. Please try again.";
        } else if (backendError.includes("too large")) {
          userFriendlyError = "Email or password is too long. Please check your input.";
        }
        
        setError(userFriendlyError);
      }
    } catch (error) {
      // Handle network or other errors
      console.error("Login error:", error);
      setError(`Network error: ${error.message || "Please try again."}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen flex flex-col lg:flex-row pre-login-bg overflow-hidden">
      <style>{`
        /* iPhone SE presets only (375×667 Chrome; 320×568 original) — nudge content up so bottom tagline isn’t clipped */
        @media (max-width: 375px) and (max-height: 667px) {
          .login-page-se-mobile-col {
            padding-top: 3rem !important;
            padding-bottom: 1.25rem !important;
          }
          .login-page-se-mobile-col .login-page-se-branding {
            margin-bottom: 0.75rem !important;
          }
          .login-page-se-mobile-col .login-page-se-tagline {
            margin-top: 0.75rem !important;
            padding-bottom: 0.75rem !important;
          }
        }
        @media (max-width: 320px) and (max-height: 568px) {
          .login-page-se-mobile-col {
            padding-top: 2.5rem !important;
          }
          .login-page-se-mobile-col .login-page-se-branding {
            margin-bottom: 0.5rem !important;
          }
        }
      `}</style>
      <PreLoginBranding />

      {/* Right side - Login form (full width on mobile, 50% on desktop) */}
      <div
        className="login-page-se-mobile-col w-full lg:w-1/2 flex flex-col items-center justify-start md:justify-center lg:justify-center p-4 sm:p-6 md:p-8 pt-20 sm:pt-24 md:pt-16 lg:py-8 pb-8 sm:pb-12 lg:pb-8 h-screen pre-login-bg relative overflow-y-auto lg:overflow-hidden"
      >
        {/* Mobile branding header (visible only on mobile/tablet) */}
        <div className="login-page-se-branding lg:hidden mb-6 sm:mb-8 md:mb-10 text-center relative z-10">
          <h1 className="text-5xl sm:text-6xl md:text-8xl font-serif text-gray-800 mb-3 leading-tight">Dorm Mart</h1>
          <h2 className="text-xl sm:text-2xl md:text-4xl font-light text-gray-600 opacity-90 leading-relaxed">
            Wastage, who?
          </h2>
        </div>

        <div className="w-full max-w-md md:max-w-xl relative z-10">
          <div
            className="p-4 sm:p-6 md:p-10 rounded-lg relative bg-blue-600"
          >
            {/* Torn paper effect */}
            <div
              className="absolute inset-0 rounded-lg bg-blue-600"
              style={{
                clipPath:
                  "polygon(0 0, 100% 0, 100% 85%, 95% 90%, 100% 95%, 100% 100%, 0 100%)",
              }}
            ></div>

            <div className="relative z-10">
              {/* Header with dot */}
              <div className="text-center mb-4 sm:mb-6 md:mb-8">
                <div className="w-3 h-3 sm:w-3.5 sm:h-3.5 bg-black rounded-full mx-auto mb-3 sm:mb-4"></div>
                <h2 className="text-2xl sm:text-3xl md:text-5xl font-serif text-white leading-tight">
                  Log In
                </h2>
              </div>

              {/* Success message display */}
              {success && (
                <div className="mb-4 p-3 sm:p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg">
                  <p className="text-sm sm:text-base leading-relaxed">{success}</p>
                </div>
              )}

              {/* Error message display */}
              {error && (
                <div className="mb-4 p-3 sm:p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
                  <p className="text-sm sm:text-base leading-relaxed">{error}</p>
                </div>
              )}

              {/* Login form - Improved spacing for mobile */}
              {/* scheme-light: keep native inputs light when html gets color-scheme:dark right before navigate */}
              <form
                onSubmit={handleLogin}
                noValidate
                className="[color-scheme:light] space-y-3 sm:space-y-4 md:space-y-6"
              >
                {/* Email input */}
                <div>
                  <label className="block text-sm sm:text-base md:text-lg font-semibold text-gray-300 mb-2 sm:mb-2.5">
                    University Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      const value = e.target.value;
                      // Ensure we capture the full value up to 255 characters
                      if (value.length <= 255) {
                        setEmail(value);
                      } else {
                        setEmail(value.slice(0, 255));
                      }
                    }}
                    onPaste={(e) => {
                      // Always handle paste ourselves to ensure full email is captured
                      e.preventDefault();
                      const pastedText = (e.clipboardData || window.clipboardData).getData('text');
                      let cleanedText = pastedText.trim();
                      // Remove '-- ' prefix if present (SQL comment marker)
                      if (cleanedText.startsWith('-- ')) {
                        cleanedText = cleanedText.substring(3).trim();
                      }
                      // Limit to exactly 255 characters to match database limit
                      const trimmedText = cleanedText.slice(0, 255);
                      setEmail(trimmedText);
                    }}
                    maxLength={255}
                    className="w-full min-h-[44px] px-4 sm:px-5 py-3 sm:py-3.5 md:py-5 rounded-lg border-2 border-gray-300 bg-white text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-4 focus:ring-blue-400/30 focus:border-blue-400 transition-all duration-200 shadow-sm hover:shadow-md focus:shadow-lg text-base sm:text-lg md:text-xl"
                  />
                </div>

                {/* Password input */}
                <div>
                  <label className="block text-sm sm:text-base md:text-lg font-semibold text-gray-300 mb-2 sm:mb-2.5">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    maxLength={64}
                    className="w-full min-h-[44px] px-4 sm:px-5 py-3 sm:py-3.5 md:py-5 rounded-lg border-2 border-gray-300 bg-white text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-4 focus:ring-blue-400/30 focus:border-blue-400 transition-all duration-200 shadow-sm hover:shadow-md focus:shadow-lg text-base sm:text-lg md:text-xl"
                  />
                </div>

                {/* Login button with arrow - Minimum 44px height for touch targets */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full min-h-[44px] bg-sky-500 hover:bg-sky-600 disabled:bg-sky-300 disabled:cursor-not-allowed text-white py-3 sm:py-3.5 md:py-5 rounded-lg flex items-center justify-center space-x-2 transition-all duration-200 hover:scale-105 hover:shadow-lg font-medium disabled:hover:scale-100 text-base sm:text-lg md:text-xl active:scale-95"
                >
                  <span>{loading ? "Logging in..." : "Login"}</span>
                  {!loading && (
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
              <div className="mt-6 sm:mt-8 text-center">
                <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm sm:text-base md:text-lg text-white">
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      navigate("/create-account");
                    }}
                    className="min-h-[44px] flex items-center px-2 py-2 hover:underline hover:text-blue-400 transition-colors duration-200"
                  >
                    Create Account
                  </a>
                  <span className="w-1 h-1 bg-black rounded-full"></span>
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      navigate("/forgot-password");
                    }}
                    className="min-h-[44px] flex items-center px-2 py-2 hover:underline hover:text-blue-400 transition-colors duration-200"
                  >
                    Forgot Password?
                  </a>
                </div>
              </div>
            </div>
          </div>
          
          {/* Tagline - Mobile only, outside login card */}
          <p className="login-page-se-tagline lg:hidden mt-6 sm:mt-8 md:mt-10 text-base sm:text-lg md:text-2xl text-gray-600 opacity-80 max-w-sm md:max-w-lg mx-auto leading-relaxed text-center px-4">
            Your campus marketplace for buying and selling. Connect with fellow students and save money.
          </p>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
