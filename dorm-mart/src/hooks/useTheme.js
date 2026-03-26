import { useState, useRef } from 'react';

const API_BASE = process.env.REACT_APP_API_BASE || "/api";
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

export function useTheme() {
  const readDOM = () =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
      ? 'dark'
      : 'light';

  const [theme, setTheme] = useState(readDOM);
  const saveControllerRef = useRef(null);

  const saveTheme = async (newTheme) => {
    if (saveControllerRef.current) saveControllerRef.current.abort();
    const controller = new AbortController();
    saveControllerRef.current = controller;

    try { localStorage.setItem(CACHE_KEY, newTheme); } catch (_) {}

    try {
      await fetch(`${API_BASE}/userPreferences.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ theme: newTheme }),
        signal: controller.signal,
      });
    } catch (e) {
      if (e.name !== 'AbortError') console.warn('Failed to save theme:', e);
    }
  };

  const updateTheme = (newTheme) => {
    setTheme(newTheme);
    applyToDOM(newTheme);

    try {
      localStorage.setItem(PENDING_KEY, JSON.stringify({ theme: newTheme, ts: Date.now() }));
    } catch (_) {}

    saveTheme(newTheme);
  };

  // isLoading is always false — loadUserTheme in RootLayout already resolved
  // the authoritative theme before any page component mounts.
  return { theme, updateTheme, isLoading: false };
}
