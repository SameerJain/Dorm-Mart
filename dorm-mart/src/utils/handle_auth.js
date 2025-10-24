import { useEffect, useState } from 'react';


const apiBase = process.env.REACT_APP_API_BASE || "http://localhost/api";

// Logout function - calls backend to clear auth token
export async function logout() {
  try {
    const response = await fetch(`${apiBase}/auth/logout.php`, {
      method: "POST",
      credentials: "include", // Important: include cookies
      headers: {
        "Content-Type": "application/json",
      },
    });

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

export function get_user_id() {
  const [userId, setUserId] = useState<number | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch_me(ctrl.signal).then(d => setUserId(d.user_id)).catch(() => setUserId(null));
    return () => ctrl.abort();
  }, []);

  return userId;
}


