# Server-Side Authentication Implementation

This document describes the server-side authentication system implemented for security compliance.

## Overview

The authentication system uses:
- **Server-side token generation** with secure random bytes
- **Bcrypt hashing** for token storage in database
- **httpOnly cookies** to prevent JavaScript access (XSS protection)
- **30-day token expiration** following security best practices
- **CORS with credentials** for cross-origin authenticated requests

## Architecture

### Database Schema
The `user_accounts` table includes:
```sql
hash_auth VARCHAR(255) DEFAULT NULL -- Stores bcrypt hash of auth token
```

### Two-Cookie System

For security and usability, we use TWO cookies:

1. **`auth_token`** (httpOnly, secure)
   - Contains the actual authentication token
   - Cannot be read by JavaScript (XSS protection)
   - Used by backend to validate requests

2. **`logged_in`** (non-httpOnly)
   - Simple "true" flag for frontend UI state
   - Contains no sensitive data
   - Used by React to show/hide UI elements

### Components

1. **login.php** - Authenticates user and sets both cookies
2. **logout.php** - Clears auth token from database and both cookies
3. **has_auth.php** - Utility function to validate authentication in protected endpoints
4. **auth.js** - Frontend utility to check authentication status using `logged_in` cookie

## Usage

### 1. Login Flow

**Backend (`api/auth/login.php`):**
- Validates credentials
- Generates 64-character hex token (`bin2hex(random_bytes(32))`)
- Hashes token with bcrypt and stores in `hash_auth` column
- Sets httpOnly cookie with unhashed token
- Returns `{ok: true, user_id: <id>}`

**Frontend:**
```javascript
const response = await fetch(`${API_BASE}/auth/login.php`, {
  method: 'POST',
  credentials: 'include', // Important: allows cookies
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
});

if (response.ok) {
  // Cookie is automatically set by browser
  // Navigate to protected area
}
```

### 2. Protected Endpoints

Any API endpoint requiring authentication should use `has_auth()`:

```php
<?php
require_once __DIR__ . '/auth/utility/has_auth.php';

// This line validates authentication or exits with 401
$userId = has_auth();

// If we reach here, user is authenticated
// Use $userId for user-specific operations
?>
```

### 3. Frontend Auth Check

```javascript
import { isAuthenticated } from '../utils/auth';

// Check if user has auth cookie
if (isAuthenticated()) {
  // User is logged in
}
```

### 4. Logout Flow

**Frontend:**
```javascript
import { logout } from '../utils/auth';

await logout(); // Clears server-side token and cookie
```

**Backend (`api/auth/logout.php`):**
- Finds user by validating token
- Sets `hash_auth` to NULL in database
- Expires the cookie

## Security Features

### ✅ httpOnly Cookie for Auth
- `auth_token` cookie cannot be accessed by JavaScript
- Protects against XSS attacks stealing authentication tokens
- Companion `logged_in` cookie is readable but contains no sensitive data

### ✅ Secure Flag
- Cookie only sent over HTTPS in production
- Prevents man-in-the-middle attacks

### ✅ SameSite=Strict
- Cookie only sent to same-site requests
- Protects against CSRF attacks

### ✅ Token Hashing
- Tokens are hashed with bcrypt before database storage
- Even if database is compromised, tokens cannot be used

### ✅ Server-Side Validation
- All authentication checks happen server-side
- Frontend cannot manipulate authentication state

### ✅ Reasonable Expiration
- 30-day expiration (not 1 year)
- Limits exposure from token theft

## Testing

Run the 5 test cases documented in the test cards:
1. httpOnly cookie validation
2. Database hash_auth storage verification
3. JavaScript access prevention
4. Invalid credentials handling
5. Token expiration validation

## Migration from Old System

### What Changed:
- ❌ **Removed:** Client-side token generation in `auth.js`
- ❌ **Removed:** `setAuthToken()` function
- ✅ **Added:** Server-side token generation in `login.php`
- ✅ **Added:** `has_auth()` utility for protected endpoints
- ✅ **Updated:** CORS headers to allow credentials
- ✅ **Updated:** All API calls must include `credentials: 'include'`

### Breaking Changes:
- Tests checking for JavaScript-readable `auth_token` will fail (by design)
- `auth_token` cookie value is NOT readable by JavaScript (security feature)
- Frontend now checks `logged_in` cookie instead of `auth_token`
- All API calls must include `credentials: 'include'`

## Environment Configuration

⚠️ **IMPORTANT:** Before deploying to production, update cookie settings:

**Current (Local Development - HTTP):**
```php
// In login.php and logout.php
'secure' => false,  // Allows cookies over HTTP
```

**For Production (HTTPS):**
```php
// In login.php and logout.php - change BOTH files
'secure' => true,   // Requires HTTPS
```

You must update this in **TWO places:**
1. `login.php` lines 125 and 138
2. `logout.php` lines 78 and 90

## API Endpoints

| Endpoint | Method | Auth Required | Description |
|----------|--------|---------------|-------------|
| `/api/auth/login.php` | POST | No | Login and set auth cookie |
| `/api/auth/logout.php` | POST | Yes | Clear auth token |
| All other `/api/*` | * | Depends | Use `has_auth()` as needed |

## Troubleshooting

### "Unauthorized" errors on protected endpoints
- Ensure fetch includes `credentials: 'include'`
- Check cookie is being sent in request headers
- Verify CORS allows credentials

### Cookie not being set
- Check CORS origin matches request origin
- Cannot use `*` with credentials
- Verify `Access-Control-Allow-Credentials: true` header

### httpOnly cookie not working locally
- Set `'secure' => false` for HTTP development
- Or use HTTPS locally with self-signed cert

## Future Enhancements

- [ ] Add token refresh mechanism
- [ ] Implement session management table
- [ ] Add rate limiting for login attempts
- [ ] Add "remember me" option with different expiration
- [ ] Add IP address validation
- [ ] Add user agent validation

