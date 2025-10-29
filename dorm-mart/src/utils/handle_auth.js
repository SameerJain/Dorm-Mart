import { closeSocket } from '../server/ws-demo';

const BASE = process.env.REACT_APP_API_BASE || "http://localhost/api";

// Logout function - calls backend to clear auth token
export async function logout() {
  try {

    // Get user ID before logout to clear user-specific theme
    let userId = null;
    try {
      const meJson = await fetch_me();
      userId = meJson.user_id;
    } catch (e) {
      // User not authenticated
    }

    const response = await fetch(`${BASE}/auth/logout.php`, {
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

    // disconnets websocket
    closeSocket();

    return response.ok;
  } catch (error) {
    console.error("Logout error:", error);
    return false;
  }
}

// if user authenticated, return {"success": true, 'user_id': user_id}
export async function fetch_me(signal) {
  const r = await fetch(`${BASE}/auth/me.php`, {
    method: 'GET',
    credentials: 'include', // send cookies (PHP session) with the request
    headers: { 'Accept': 'application/json' },
    signal // allows aborting the request if the component unmounts
  });
  if (!r.ok) throw new Error(`not authenticated`);
  return r.json();
}



