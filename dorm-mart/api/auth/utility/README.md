# Cookie Authentication Guide

Simple cookie-based authentication for protecting API endpoints.

## How It Works

1. **Login** - User logs in with email/password
   - Server generates a random token
   - Token is hashed and stored in `user_accounts.hash_auth`
   - Unhashed token is sent to browser as `auth_token` cookie (httpOnly)

2. **Protected Endpoints** - Use `has_auth()` to verify users
   - Cookie is automatically sent with each request
   - `has_auth()` verifies the token against database
   - Returns `user_id` if valid, or exits with 401 if not

3. **Logout** - Clears the cookie and database hash

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

The frontend needs to include credentials in fetch requests:

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

- **login.php** - Handles user login, creates auth token
- **logout.php** - Handles logout, clears token
- **has_auth.php** - Helper function to protect endpoints
- **example_protected_endpoint.php** - Example of protected endpoint

## Security Notes

- Tokens are 64 hex characters (32 random bytes)
- Stored hashed in database using bcrypt
- Sent as httpOnly cookie (JavaScript can't access it)
- 30 day expiration
- Set `secure => true` in production for HTTPS only

