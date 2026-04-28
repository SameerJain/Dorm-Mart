import { useState, useRef, useCallback } from 'react';
import {
  applyThemeToDOM,
  getEffectivePendingTheme,
  THEME_CACHE_KEY,
  THEME_PENDING_KEY,
} from '../utils/load_theme.js';
import { API_BASE } from '../utils/apiConfig';

export function useTheme() {
  const readDOM = () =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
      ? 'dark'
      : 'light';

  const [theme, setTheme] = useState(readDOM);
  const saveControllerRef = useRef(null);

  const saveTheme = useCallback(async (newTheme) => {
    if (saveControllerRef.current) saveControllerRef.current.abort();
    const controller = new AbortController();
    saveControllerRef.current = controller;

    try {
      localStorage.setItem(THEME_CACHE_KEY, newTheme);
    } catch (_) {}

    try {
      const res = await fetch(`${API_BASE}/profile/userPreferences.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ theme: newTheme }),
        signal: controller.signal,
      });
      if (res.ok) {
        try {
          localStorage.removeItem(THEME_PENDING_KEY);
        } catch (_) {}
      }
    } catch (e) {
      if (e.name !== 'AbortError') console.warn('Failed to save theme:', e);
    }
  }, []);

  const updateTheme = useCallback(
    (newTheme) => {
      setTheme(newTheme);
      applyThemeToDOM(newTheme);

      try {
        localStorage.setItem(
          THEME_PENDING_KEY,
          JSON.stringify({ theme: newTheme, ts: Date.now() })
        );
      } catch (_) {}

      saveTheme(newTheme);
    },
    [saveTheme]
  );

  /** Align React state + DOM with server when user has not toggled recently (avoids fighting updateTheme). */
  const syncFromServerIfNoPending = useCallback((serverTheme) => {
    if (serverTheme !== 'dark' && serverTheme !== 'light') return;
    if (getEffectivePendingTheme()) return;
    setTheme(serverTheme);
    applyThemeToDOM(serverTheme);
  }, []);

  return { theme, updateTheme, syncFromServerIfNoPending, isLoading: false };
}
