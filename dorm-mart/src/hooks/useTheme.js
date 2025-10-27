import { useState, useEffect } from 'react';

const API_BASE = process.env.REACT_APP_API_BASE || "/api";

export function useTheme() {
  const [theme, setTheme] = useState('light');
  const [isLoading, setIsLoading] = useState(true);

  // Load theme from backend on mount
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const res = await fetch(`${API_BASE}/userPreferences.php`, { 
          method: 'GET', 
          credentials: 'include' 
        });
        if (res.ok) {
          const json = await res.json();
          if (json?.ok && json?.data?.theme) {
            setTheme(json.data.theme);
            applyTheme(json.data.theme);
          }
        }
      } catch (e) {
        console.warn('Failed to load theme:', e);
      } finally {
        setIsLoading(false);
      }
    };

    loadTheme();
  }, []);

  // Apply theme to document
  const applyTheme = (newTheme) => {
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  // Save theme to backend
  const saveTheme = async (newTheme) => {
    try {
      await fetch(`${API_BASE}/userPreferences.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ theme: newTheme }),
      });
    } catch (e) {
      console.warn('Failed to save theme:', e);
    }
  };

  // Update theme function
  const updateTheme = (newTheme) => {
    setTheme(newTheme);
    applyTheme(newTheme);
    saveTheme(newTheme);
  };

  return { theme, updateTheme, isLoading };
}
