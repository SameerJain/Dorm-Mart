import { useState, useEffect } from 'react';

const API_BASE = process.env.REACT_APP_API_BASE || "/api";

export function useTheme() {
  const [theme, setTheme] = useState('light');
  const [isLoading, setIsLoading] = useState(true);

  // Load theme from backend on mount
  useEffect(() => {
    const loadTheme = async () => {
      try {
        // First try to get from localStorage as immediate fallback
        const localTheme = localStorage.getItem('userTheme');
        if (localTheme) {
          setTheme(localTheme);
          applyTheme(localTheme);
        }

        // Then try to get from backend
        const res = await fetch(`${API_BASE}/userPreferences.php`, { 
          method: 'GET', 
          credentials: 'include' 
        });
        if (res.ok) {
          const json = await res.json();
          if (json?.ok && json?.data?.theme) {
            setTheme(json.data.theme);
            applyTheme(json.data.theme);
            // Update localStorage with backend value
            localStorage.setItem('userTheme', json.data.theme);
          }
        }
      } catch (e) {
        console.warn('Failed to load theme:', e);
        // Keep localStorage value if backend fails
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

  // Save theme to backend and localStorage
  const saveTheme = async (newTheme) => {
    // Save to localStorage immediately
    localStorage.setItem('userTheme', newTheme);
    
    try {
      // First get current preferences to avoid overwriting them
      const getRes = await fetch(`${API_BASE}/userPreferences.php`, { 
        method: 'GET', 
        credentials: 'include' 
      });
      
      let currentPrefs = {
        promoEmails: false,
        revealContact: false,
        interests: []
      };
      
      if (getRes.ok) {
        const getJson = await getRes.json();
        if (getJson?.ok && getJson?.data) {
          currentPrefs = {
            promoEmails: getJson.data.promoEmails || false,
            revealContact: getJson.data.revealContact || false,
            interests: getJson.data.interests || []
          };
        }
      }
      
      // Now save with all preferences including the new theme
      const res = await fetch(`${API_BASE}/userPreferences.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          ...currentPrefs,
          theme: newTheme 
        }),
      });
      if (!res.ok) {
        console.warn('Failed to save theme to backend');
      }
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
