import {
  applyThemeToDOM,
  THEME_CACHE_KEY,
  THEME_PENDING_KEY,
} from "./loadTheme.js";
import { API_BASE } from "./apiConfig";

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

    const response = await fetch(`${API_BASE}/auth/logout.php`, {
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

    return response.ok;
  } catch (error) {
    console.error("Logout error:", error);
    return false;
  }
}

// if user authenticated, return {"success": true, 'user_id': user_id}
export async function fetchMe(signal) {
  const r = await fetch(`${API_BASE}/auth/me.php`, {
    method: "GET",
    credentials: "include", // send cookies (PHP session) with the request
    headers: { Accept: "application/json" },
    signal, // allows aborting the request if the component unmounts
  });
  if (!r.ok) throw new Error(`not authenticated`);
  return r.json();
}
