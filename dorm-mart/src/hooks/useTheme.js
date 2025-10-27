import { useState, useEffect } from 'react';

const API_BASE = process.env.REACT_APP_API_BASE || "/api";

export function useTheme() {
  const [theme, setTheme] = useState('light');
  const [isLoading, setIsLoading] = useState(true);

  // Load theme from backend on mount
  useEffect(() => {
    const loadTheme = async () => {
      try {
        // First clear any existing theme to prevent cross-user contamination
        document.documentElement.classList.remove('dark');
        
        // Get user ID for user-specific localStorage
        let userId = null;
        try {
          const meRes = await fetch(`${API_BASE}/auth/me.php`, { 
            method: 'GET', 
            credentials: 'include' 
          });
          if (meRes.ok) {
            const meJson = await meRes.json();
            userId = meJson.user_id;
          }
        } catch (e) {
          // User not authenticated
        }

        // Try localStorage first for immediate application
        if (userId) {
          const userThemeKey = `userTheme_${userId}`;
          const localTheme = localStorage.getItem(userThemeKey);
          if (localTheme) {
            setTheme(localTheme);
            applyTheme(localTheme);
          }
        }

        // Then get from backend and override localStorage
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
            if (userId) {
              const userThemeKey = `userTheme_${userId}`;
              localStorage.setItem(userThemeKey, json.data.theme);
            }
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

  // Save theme to backend and localStorage
  const saveTheme = async (newTheme) => {
    // Get user ID for user-specific localStorage
    let userId = null;
    try {
      const meRes = await fetch(`${API_BASE}/auth/me.php`, { 
        method: 'GET', 
        credentials: 'include' 
      });
      if (meRes.ok) {
        const meJson = await meRes.json();
        userId = meJson.user_id;
      }
    } catch (e) {
      // User not authenticated
    }

    // Save to localStorage immediately with user-specific key
    if (userId) {
      const userThemeKey = `userTheme_${userId}`;
      localStorage.setItem(userThemeKey, newTheme);
    }
    
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
