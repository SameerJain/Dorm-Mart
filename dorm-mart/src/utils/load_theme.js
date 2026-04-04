export const THEME_CACHE_KEY = 'dm_last_theme';
export const THEME_PENDING_KEY = 'dm_theme_pending';

/** How long a client-side theme toggle wins over a stale in-flight server response (ms). */
const PENDING_THEME_TTL_MS = 120_000;

/**
 * Update <html> class, localStorage cache, browser UI (theme-color), and color-scheme for form controls.
 */
export function applyThemeToDOM(theme) {
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
    document.documentElement.style.colorScheme = 'dark';
  } else {
    document.documentElement.classList.remove('dark');
    document.documentElement.style.colorScheme = 'light';
  }
  try {
    localStorage.setItem(THEME_CACHE_KEY, theme);
  } catch (_) {}

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', theme === 'dark' ? '#0f172a' : '#ffffff');
  }
}

export function getEffectivePendingTheme() {
  try {
    const pendingRaw = localStorage.getItem(THEME_PENDING_KEY);
    if (!pendingRaw) return null;
    const pending = JSON.parse(pendingRaw);
    if (
      (pending?.theme !== 'dark' && pending?.theme !== 'light') ||
      typeof pending?.ts !== 'number'
    ) {
      return null;
    }
    if (Date.now() - pending.ts > PENDING_THEME_TTL_MS) return null;
    return pending.theme;
  } catch {
    return null;
  }
}

/**
 * Apply the user's theme on app boot.
 * Called by RootLayout after authentication, with the userId already known.
 */
export const loadUserTheme = async (userId) => {
  const API_BASE = (process.env.REACT_APP_API_BASE || '/api').replace(/\/$/, '');

  const pendingFirst = getEffectivePendingTheme();
  if (pendingFirst) {
    applyThemeToDOM(pendingFirst);
  } else {
    const cached = localStorage.getItem(THEME_CACHE_KEY);
    if (cached === 'dark' || cached === 'light') {
      applyThemeToDOM(cached);
    }
  }

  try {
    const res = await fetch(`${API_BASE}/userPreferences.php`, {
      method: 'GET',
      credentials: 'include',
    });
    if (res.ok) {
      const json = await res.json();
      const backendTheme = json?.ok && json?.data?.theme ? json.data.theme : null;
      if (backendTheme === 'dark' || backendTheme === 'light') {
        const pending = getEffectivePendingTheme();
        if (pending) {
          applyThemeToDOM(pending);
        } else {
          applyThemeToDOM(backendTheme);
        }
        if (userId) {
          try {
            localStorage.setItem(`userTheme_${userId}`, backendTheme);
          } catch (_) {}
        }
      }
    }
  } catch (_) {
    // Network error — cached or pending theme is already applied.
  }
};
