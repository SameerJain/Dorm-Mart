const CACHE_KEY = 'dm_last_theme';
const PENDING_KEY = 'dm_theme_pending';

function applyToDOM(theme) {
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
  try { localStorage.setItem(CACHE_KEY, theme); } catch (_) {}
}

/**
 * Apply the user's theme on app boot.
 * Called by RootLayout after authentication, with the userId already known.
 */
export const loadUserTheme = async (userId) => {
  const API_BASE = (process.env.REACT_APP_API_BASE || '/api').replace(/\/$/, '');

  // 1. If a recent toggle marker exists, honour it and stop.
  try {
    const pendingRaw = localStorage.getItem(PENDING_KEY);
    if (pendingRaw) {
      const pending = JSON.parse(pendingRaw);
      if (
        (pending?.theme === 'dark' || pending?.theme === 'light') &&
        typeof pending?.ts === 'number' &&
        Date.now() - pending.ts < 5000
      ) {
        applyToDOM(pending.theme);
        localStorage.removeItem(PENDING_KEY);
        return;
      }
    }
  } catch (_) {}

  // 2. Apply the instant cache so the page renders in the right theme
  //    while we wait for the backend. No flash.
  const cached = localStorage.getItem(CACHE_KEY);
  if (cached === 'dark' || cached === 'light') {
    applyToDOM(cached);
  }

  // 3. Fetch authoritative theme from backend and reconcile.
  try {
    const res = await fetch(`${API_BASE}/userPreferences.php`, {
      method: 'GET',
      credentials: 'include',
    });
    if (res.ok) {
      const json = await res.json();
      const backendTheme = json?.ok && json?.data?.theme ? json.data.theme : null;
      if (backendTheme === 'dark' || backendTheme === 'light') {
        applyToDOM(backendTheme);
        if (userId) {
          try { localStorage.setItem(`userTheme_${userId}`, backendTheme); } catch (_) {}
        }
      }
    }
  } catch (_) {
    // Network error — the cached theme is already applied, so nothing to do.
  }
};
