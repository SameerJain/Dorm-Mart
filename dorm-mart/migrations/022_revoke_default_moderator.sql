-- Disable only the moderator account that still uses the publicly committed password.
-- The replacement hash belongs to a discarded random value and cannot be used to log in.

UPDATE user_accounts
SET hash_pass = '$2y$10$DtgU9Y5iNlTVYfUTv3oAvut8.sOLxoQrHyJsA2BCX9PsGbz.N7wAa',
    hash_auth = NULL,
    reset_token_hash = NULL,
    reset_token_expires = NULL,
    last_reset_request = NULL,
    auth_version = auth_version + 1,
    is_banned = 1,
    banned_at = UTC_TIMESTAMP(),
    ban_reason = 'Retired insecure default credential'
WHERE email = 'moderator@buffalo.edu'
  AND hash_pass = '$2y$10$Lsi17OyY9.zy.qhCZy0G4uSVUVU7TfdkcREh9bXEu0sy1r1SgAfdm';
