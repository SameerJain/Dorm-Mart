-- Add lockout_until column for rate limiting
ALTER TABLE user_accounts ADD COLUMN lockout_until DATETIME NULL DEFAULT NULL COMMENT "When the account lockout expires";
