import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import SettingsLayout from "./SettingsLayout";
import { useTheme } from "../../hooks/useTheme";
import PageBackButton from "../../components/PageBackButton";
import useCategories from "../../hooks/useCategories";
import logger from "../../utils/logger";
import { API_BASE } from "../../utils/apiConfig";
import { csrfFetch } from "../../utils/csrfFetch";
import {
  isValidContactPhone,
  preferenceChanges,
} from "./userPreferencesUtils";

const SAVE_DEBOUNCE_MS = 600;

function UserPreferences() {
  const navigate = useNavigate();
  const { theme, updateTheme, syncFromServerIfNoPending } = useTheme();
  const [promoFrequency, setPromoFrequency] = useState("off");
  const [revealContact, setRevealContact] = useState(false);
  const [contactPhone, setContactPhone] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedInterests, setSelectedInterests] = useState([]);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [saveError, setSaveError] = useState("");
  const [saveStatus, setSaveStatus] = useState("idle");
  // Last values the server confirmed. Autosave sends only what differs from it,
  // so a load never echoes the same values back and a partial save cannot
  // overwrite a field the user did not touch.
  const savedRef = useRef(null);
  const showSuggestions = searchQuery.length > 0;
  const phoneInvalid = !isValidContactPhone(contactPhone);

  const {
    categories: availableCategories,
    loading: categoriesLoading,
    error: categoriesError,
  } = useCategories();

  const handleInterestToggle = (interest) => {
    setSelectedInterests((prev) => {
      if (prev.includes(interest)) {
        return prev.filter((item) => item !== interest);
      }
      return prev.length >= 3 ? prev : [...prev, interest];
    });
  };

  const handleInterestRemove = (interest) => {
    setSelectedInterests((prev) => prev.filter((item) => item !== interest));
  };

  // Only predefined categories can be chosen, so Enter must not submit free text.
  const handleSearchKeyDown = (e) => {
    if (e.key === "Enter") e.preventDefault();
  };

  const filteredCategories = availableCategories.filter(
    (category) =>
      category.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !selectedInterests.includes(category),
  );

  // Hydrate from backend on mount, and again when the user presses Retry.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoadError("");
        const res = await fetch(`${API_BASE}/profile/user_preferences.php`, {
          method: "GET",
          credentials: "include",
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json || json.ok !== true || !json.data) {
          throw new Error((json && json.error) || "Unable to load your preferences.");
        }
        if (cancelled) return;
        const {
          promoEmails,
          promoFrequency: savedPromoFrequency,
          revealContact: savedRevealContact,
          contactPhone: savedContactPhone,
          interests,
          theme: serverTheme,
        } = json.data;
        const loaded = {
          promoFrequency: savedPromoFrequency || (promoEmails ? "weekly" : "off"),
          revealContact: !!savedRevealContact,
          contactPhone: savedContactPhone || "",
          interests: Array.isArray(interests) ? interests : [],
        };
        savedRef.current = loaded;
        setPromoFrequency(loaded.promoFrequency);
        setRevealContact(loaded.revealContact);
        setContactPhone(loaded.contactPhone);
        setSelectedInterests(loaded.interests);
        if (serverTheme === "dark" || serverTheme === "light") {
          syncFromServerIfNoPending(serverTheme);
        }
        setPreferencesLoaded(true);
      } catch (e) {
        logger.warn("UserPreferences: GET failed", e);
        // Leave preferencesLoaded false: autosaving the untouched defaults
        // would overwrite the user's real settings.
        if (!cancelled) setLoadError(e.message || "Unable to load your preferences.");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadAttempt]);

  // Save changed fields to the backend (debounced). Theme is saved by useTheme.
  useEffect(() => {
    if (!preferencesLoaded || !savedRef.current) return undefined;

    const current = {
      promoFrequency,
      revealContact,
      contactPhone,
      interests: selectedInterests,
    };
    const changes = preferenceChanges(savedRef.current, current);
    if (changes === null) return undefined;

    const controller = new AbortController();
    const t = setTimeout(async () => {
      setSaveStatus("saving");
      try {
        const response = await csrfFetch(`${API_BASE}/profile/user_preferences.php`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(changes),
          signal: controller.signal,
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || result.ok !== true) {
          throw new Error(result.error || "Unable to save preferences.");
        }
        savedRef.current = { ...savedRef.current, ...current };
        // Show the server's formatted phone number once the user has stopped typing.
        const serverPhone = result.data && result.data.contactPhone;
        if (typeof serverPhone === "string" && "contactPhone" in changes) {
          savedRef.current.contactPhone = serverPhone;
          setContactPhone(serverPhone);
        }
        setSaveError("");
        setSaveStatus("saved");
      } catch (e) {
        if (e.name !== "AbortError") {
          logger.warn("UserPreferences: POST failed", e);
          setSaveError(e.message || "Unable to save preferences.");
          setSaveStatus("idle");
        }
      }
    }, SAVE_DEBOUNCE_MS);
    return () => {
      controller.abort();
      clearTimeout(t);
    };
  }, [
    promoFrequency,
    revealContact,
    contactPhone,
    selectedInterests,
    preferencesLoaded,
  ]);

  return (
    <SettingsLayout>
      <div className="mb-6 flex items-center justify-between border-b border-slate-200 pb-3 dark:border-gray-700">
        <h1 className="text-2xl font-serif font-semibold text-blue-600">
          User Preferences
        </h1>
        <PageBackButton onClick={() => navigate(-1)} />
      </div>

      <div className="space-y-8">
        {loadError && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-red-100 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200"
          >
            <span>
              {loadError} Changes won&apos;t be saved until your preferences load.
            </span>
            <button
              type="button"
              onClick={() => setLoadAttempt((n) => n + 1)}
              className="rounded-md border border-red-300 px-3 py-1 font-medium hover:bg-red-200 dark:border-red-800 dark:hover:bg-red-900"
            >
              Retry
            </button>
          </div>
        )}
        {saveError && (
          <p role="alert" className="rounded-lg bg-red-100 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
            {saveError}
          </p>
        )}
        <p
          aria-live="polite"
          className="-mt-4 min-h-[1.25rem] text-right text-xs text-slate-500 dark:text-gray-400"
        >
          {saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "All changes saved" : ""}
        </p>
        {/* Notification Settings */}
        <div className="rounded-lg border border-slate-200 dark:border-gray-600 p-6 bg-white dark:bg-gray-800">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-gray-100 mb-4">
            Notification Settings
          </h2>
          <div className="flex flex-col gap-2 sm:max-w-sm">
            <label
              htmlFor="promotional-emails"
              className="text-sm text-slate-700 dark:text-gray-300"
            >
              Promotional email frequency
            </label>
            <select id="promotional-emails" value={promoFrequency} onChange={(e) => setPromoFrequency(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100">
              <option value="off">Off</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
            <p className="text-xs text-slate-500 dark:text-gray-400">Receive active listings matched to your selected interests.</p>
          </div>
        </div>

        {/* My Interests */}
        <div className="rounded-lg border border-slate-200 dark:border-gray-600 p-6 bg-white dark:bg-gray-800">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-gray-100 mb-4">
            My Interests
          </h2>

          {/* Search Bar with Enhanced Functionality */}
          <div className="relative mb-4">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg
                className="h-4 w-4 text-gray-400 dark:text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <input
              type="text"
              aria-label="Search categories"
              placeholder="Search categories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              maxLength={50}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
            />
          </div>

          {/* Selected Interests with Enhanced UI */}
          {selectedInterests.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Selected Interests ({selectedInterests.length}/3)
                </p>
                <button
                  type="button"
                  onClick={() => setSelectedInterests([])}
                  className="text-xs text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                >
                  Clear All
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedInterests.map((interest) => (
                  <span
                    key={interest}
                    className="inline-flex items-center rounded-full border border-blue-200 bg-blue-100 px-3 py-1 text-sm text-blue-800 dark:border-blue-700 dark:bg-blue-900 dark:text-blue-200"
                  >
                    {interest}
                    <button
                      type="button"
                      onClick={() => handleInterestRemove(interest)}
                      aria-label={`Remove ${interest}`}
                      className="ml-2 text-blue-600 transition-colors hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-100"
                    >
                      <svg
                        className="h-3 w-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Enhanced Suggestions Dropdown */}
          {showSuggestions && (
            <div className="mb-4">
              <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-600 dark:bg-gray-800">
                {filteredCategories.length > 0 ? (
                  <>
                    <div className="border-b border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-600 dark:bg-gray-700">
                      <p className="text-xs font-medium text-gray-600 dark:text-gray-300">
                        Suggested Categories
                      </p>
                    </div>
                    <div className="p-2">
                      {filteredCategories.slice(0, 8).map((category) => (
                        <button
                          type="button"
                          key={category}
                          onClick={() => {
                            handleInterestToggle(category);
                            setSearchQuery("");
                          }}
                          className="w-full rounded-md px-3 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-blue-50 hover:text-blue-800 dark:text-gray-200 dark:hover:bg-gray-700 dark:hover:text-blue-200"
                        >
                          <span className="flex items-center">
                            <svg
                              className="mr-2 h-4 w-4 text-gray-400"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                              />
                            </svg>
                            {category}
                          </span>
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="px-3 py-4 text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      No matching categories found
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      Only predefined categories are available
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Popular Categories */}
          {!searchQuery && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Popular Categories
              </p>
              {categoriesLoading ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Loading categories...
                </p>
              ) : categoriesError ? (
                <div className="space-y-2">
                  <p className="text-sm text-red-500 dark:text-red-400">
                    Failed to load categories: {categoriesError}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Please refresh the page or check your connection.
                  </p>
                </div>
              ) : availableCategories.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No categories available
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {availableCategories.map((category) => (
                    <button
                      type="button"
                      key={category}
                      onClick={() => handleInterestToggle(category)}
                      disabled={
                        selectedInterests.length >= 3 &&
                        !selectedInterests.includes(category)
                      }
                      className={`px-3 py-1 text-sm rounded-full border transition-all duration-200 ${
                        selectedInterests.includes(category)
                          ? "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-700 cursor-not-allowed"
                          : selectedInterests.length >= 3
                            ? "bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-600 cursor-not-allowed"
                            : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
                      }`}
                    >
                      {selectedInterests.includes(category) ? "✓ " : "+ "}
                      {category}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Seller privacy */}
        <div className="rounded-lg border border-slate-200 dark:border-gray-600 p-6 bg-white dark:bg-gray-800">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-gray-100 mb-4">
            Seller Privacy
          </h2>
          <div className="max-w-lg space-y-4">
            <div>
              <label
                htmlFor="contact-phone"
                className="text-sm font-medium text-slate-700 dark:text-gray-300"
              >
                Phone number (optional)
              </label>
              <input
                type="tel"
                id="contact-phone"
                value={contactPhone}
                onChange={(e) =>
                  setContactPhone(
                    e.target.value.replace(/[^0-9+().\-\s]/g, "").slice(0, 25),
                  )
                }
                autoComplete="tel"
                inputMode="tel"
                placeholder="(716) 555-0123"
                aria-invalid={phoneInvalid}
                aria-describedby={phoneInvalid ? "contact-phone-hint" : undefined}
                className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              />
              {phoneInvalid && (
                <p
                  id="contact-phone-hint"
                  className="mt-1 text-xs text-amber-700 dark:text-amber-300"
                >
                  Enter a 10-digit US number to save it, or clear the field.
                </p>
              )}
            </div>
            <div className="flex items-start space-x-3">
              <input
                type="checkbox"
                id="reveal-contact"
                checked={revealContact}
                onChange={(e) => setRevealContact(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600"
              />
              <label
                htmlFor="reveal-contact"
                className="text-sm text-slate-700 dark:text-gray-300"
              >
                Share my email{contactPhone ? " and phone number" : ""} with
                buyers who message me about one of my listings.
              </label>
            </div>
            <p className="text-xs text-slate-500 dark:text-gray-400">
              Contact information is hidden by default and is never shown on
              your public profile.
            </p>
          </div>
        </div>

        {/* Theme */}
        <div className="rounded-lg border border-slate-200 dark:border-gray-600 p-6 bg-white dark:bg-gray-800">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-gray-100 mb-4">
            Theme
          </h2>

          {/* Theme Toggle */}
          <div className="flex items-center space-x-4 mb-4">
            <div className="flex rounded-lg bg-gray-100 p-1 dark:bg-gray-700/80">
              <button
                type="button"
                onClick={() => updateTheme("light")}
                className={`flex items-center space-x-2 rounded-md px-3 py-2 transition-colors ${
                  theme === "light"
                    ? "bg-white text-gray-900 shadow-sm dark:bg-gray-600 dark:text-gray-100 dark:shadow-md dark:ring-1 dark:ring-gray-500"
                    : "text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                }`}
              >
                <svg
                  className="h-4 w-4 shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  aria-hidden
                >
                  <path
                    fillRule="evenodd"
                    d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="text-sm font-medium">Light</span>
              </button>
              <button
                type="button"
                onClick={() => updateTheme("dark")}
                className={`flex items-center space-x-2 rounded-md px-3 py-2 transition-colors ${
                  theme === "dark"
                    ? "bg-white text-gray-900 shadow-sm dark:bg-gray-600 dark:text-gray-100 dark:shadow-md dark:ring-1 dark:ring-gray-500"
                    : "text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                }`}
              >
                <svg
                  className="h-4 w-4 shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  aria-hidden
                >
                  <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                </svg>
                <span className="text-sm font-medium">Dark</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </SettingsLayout>
  );
}

export default UserPreferences;
