// Authentication utility functions
// Note: auth_token cookie is now set server-side with httpOnly flag
// JavaScript cannot directly read or write the authentication token (security feature)

// Check if user is authenticated
// Note: httpOnly cookies are completely invisible to JavaScript (by design for security)
// We use a separate non-httpOnly cookie just for frontend auth state checking
export function isAuthenticated() {
  // Check for 'logged_in' companion cookie (non-httpOnly, just for UI state)
  const cookies = document.cookie.split(';');
  for (let cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === 'logged_in' && value === 'true') {
      return true;
    }
  }
  return false;
}

// Logout function - calls backend to clear auth token
export async function logout() {
  try {
    const apiBase = process.env.REACT_APP_API_BASE || 'http://localhost/api';
    const response = await fetch(`${apiBase}/auth/logout.php`, {
      method: 'POST',
      credentials: 'include', // Important: include cookies
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    return response.ok;
  } catch (error) {
    console.error('Logout error:', error);
    return false;
  }
}

// Legacy function - kept for backward compatibility but cannot read httpOnly cookie
export function getAuthToken() {
  console.warn('getAuthToken() cannot read httpOnly cookies. Use isAuthenticated() instead.');
  return null;
}

// Legacy function - use logout() instead to properly clear server-side session
export function removeAuthToken() {
  console.warn('removeAuthToken() deprecated. Use logout() to properly clear authentication.');
  logout();
}

