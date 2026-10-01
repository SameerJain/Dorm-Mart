import {
  applyThemeToDOM,
  THEME_CACHE_KEY,
  THEME_PENDING_KEY,
} from "./loadTheme.js";
import logger from "./logger";
import { API_BASE } from "./apiConfig";
import { clearCsrfToken, csrfFetch } from "./csrfFetch";

// Logout function - calls backend to clear auth token
export async function logout() {
  try {
    // Get user ID before logout to clear user-specific theme
    let userId = null;
    try {
      const meJson = await fetchMe();
      userId = meJson.user_id;
    } catch (e) {
      // User not authenticated
    }

    const response = await csrfFetch(`${API_BASE}/auth/logout.php`, {
      method: "POST",
      credentials: "include", // Important: include cookies
      headers: {
        "Content-Type": "application/json",
      },
    });

    // Reset to light theme (class, theme-color, color-scheme, cache) and clear pending toggle
    applyThemeToDOM("light");
    try {
      localStorage.removeItem(THEME_PENDING_KEY);
    } catch (_) {}
    if (userId) {
      const userThemeKey = `userTheme_${userId}`;
      try {
        localStorage.removeItem(userThemeKey);
      } catch (_) {}
    }
    try {
      localStorage.removeItem(THEME_CACHE_KEY);
    } catch (_) {}

    try {
      sessionStorage.removeItem("dm_home_feed_tab");
    } catch (_) {}

    // The session that issued the cached CSRF token is gone.
    clearCsrfToken();
    return response.ok;
  } catch (error) {
    logger.error("Logout error:", error);
    return false;
  }
}

let inFlightMe = null;

// if user authenticated, return {"success": true, 'user_id': user_id}
//
// Concurrent callers share one request. With no live PHP session (e.g. after a
// browser restart) me.php signs the user back in from the remember-me cookie and
// rotates it; a second simultaneous call would still carry the old token, get a
// 401, and bounce a remembered user to the login page.
export function fetchMe(signal) {
  if (!inFlightMe) {
    inFlightMe = (async () => {
      const r = await fetch(`${API_BASE}/auth/me.php`, {
        method: "GET",
        credentials: "include", // send cookies (PHP session) with the request
        headers: { Accept: "application/json" },
      });
      if (!r.ok) throw new Error(`not authenticated`);
      return r.json();
    })().finally(() => {
      inFlightMe = null;
    });
  }
  if (!signal) return inFlightMe;

  // Aborting abandons only this caller's wait; the shared request keeps going.
  return new Promise((resolve, reject) => {
    const onAbort = () =>
      reject(new DOMException("The operation was aborted.", "AbortError"));
    if (signal.aborted) return onAbort();
    signal.addEventListener("abort", onAbort, { once: true });
    inFlightMe.then(resolve, reject).finally(() =>
      signal.removeEventListener("abort", onAbort),
    );
  });
}
