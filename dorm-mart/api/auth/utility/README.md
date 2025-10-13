# Session + Cookie Authentication Guide

Simple, pragmatic authentication that supports both PHP sessions and a persistent cookie token.

## How It Works

1. **Login** - User logs in with email/password
   - Starts a PHP session and stores `$_SESSION['user_id']`
   - Generates a random token
   - Hashes and stores it in `user_accounts.hash_auth`
   - Sends the unhashed token as `auth_token` (httpOnly) for long-lived auth

2. **Protected Endpoints** - Use `has_auth()` to verify users
   - Accepts a valid PHP session OR a valid `auth_token` cookie
   - Returns `user_id` if valid, or exits with 401 if not

3. **Logout** - Destroys the session, clears the cookie, and nulls the database hash

## Usage

### Protecting an Endpoint

```php
<?php
require_once __DIR__ . '/utility/has_auth.php';

// This will exit with 401 if user is not authenticated
$userId = has_auth();

// If we get here, user is authenticated
// Do your protected logic here
echo json_encode(['ok' => true, 'user_id' => $userId]);
?>
```

### Frontend

The frontend should include credentials in fetch requests so cookies/sessions are sent:

```javascript
fetch('http://localhost:8080/api/your-endpoint.php', {
  method: 'POST',
  credentials: 'include',  // Important! This sends cookies
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ /* your data */ })
})
```

## Database Setup

Make sure your `user_accounts` table has a `hash_auth` column:

```sql
ALTER TABLE user_accounts ADD COLUMN hash_auth VARCHAR(255) DEFAULT NULL;
```

## Files

- **login.php** - Handles user login, creates session and auth token
- **logout.php** - Handles logout, destroys session and clears token
- **has_auth.php** - Helper that validates session or token
- **example_protected_endpoint.php** - Example of protected endpoint

## Security Notes

- Tokens are 64 hex characters (32 random bytes)
- Stored hashed in database using bcrypt
- Sent as httpOnly cookie (JavaScript can't access it)
- 30 day expiration
- Set `secure => true` in production for HTTPS only

