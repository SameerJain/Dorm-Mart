// Simple cookie utility functions for authentication

// Set a cookie with far-future expiration (1 year from now)
export function setAuthToken(token) {
  const expiryDate = new Date();
  expiryDate.setFullYear(expiryDate.getFullYear() + 1); // 1 year from now
  
  document.cookie = `auth_token=${token}; expires=${expiryDate.toUTCString()}; path=/; SameSite=Lax`;
}

// Get auth_token cookie value
export function getAuthToken() {
  const cookies = document.cookie.split(';');
  
  for (let cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === 'auth_token') {
      return value;
    }
  }
  
  return null;
}

// Remove auth_token cookie
export function removeAuthToken() {
  // Set cookie with past expiration date to delete it
  document.cookie = 'auth_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
}

// Check if user is authenticated
export function isAuthenticated() {
  return getAuthToken() !== null;
}

