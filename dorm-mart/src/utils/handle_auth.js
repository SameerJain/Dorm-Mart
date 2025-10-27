import { useEffect, useState } from 'react';


const apiBase = process.env.REACT_APP_API_BASE || "http://localhost/api";

// Logout function - calls backend to clear auth token
export async function logout() {
  try {
    // Get user ID before logout to clear user-specific theme
    let userId = null;
    try {
      const meRes = await fetch(`${apiBase}/auth/me.php`, { 
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

    const response = await fetch(`${apiBase}/auth/logout.php`, {
      method: "POST",
      credentials: "include", // Important: include cookies
      headers: {
        "Content-Type": "application/json",
      },
    });

    // Clear theme from DOM and localStorage on logout
    document.documentElement.classList.remove('dark');
    
    // Clear user-specific theme from localStorage
    if (userId) {
      const userThemeKey = `userTheme_${userId}`;
      localStorage.removeItem(userThemeKey);
    }

    return response.ok;
  } catch (error) {
    console.error("Logout error:", error);
    return false;
  }
}

async function fetch_me(signal) {
  const r = await fetch('/api/auth/me', {
    method: 'GET',
    credentials: 'include', // send cookies (PHP session) with the request
    headers: { 'Accept': 'application/json' },
    signal // allows aborting the request if the component unmounts
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export function useUserId() {
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch_me(ctrl.signal).then(d => setUserId(d.user_id)).catch(() => setUserId(null));
    return () => ctrl.abort();
  }, []);

  return userId;
}


