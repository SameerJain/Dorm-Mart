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


export function get_token() {

}

export async function validate_token() {

}


