-- Separate password-reset state from remember-me tokens and version active sessions.

SET @reset_hash_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'user_accounts'
    AND COLUMN_NAME = 'reset_token_hash'
);
SET @reset_hash_sql = IF(
  @reset_hash_exists = 0,
  'ALTER TABLE user_accounts ADD COLUMN reset_token_hash VARCHAR(255) NULL DEFAULT NULL AFTER hash_auth',
  'SELECT 1'
);
PREPARE reset_hash_statement FROM @reset_hash_sql;
EXECUTE reset_hash_statement;
DEALLOCATE PREPARE reset_hash_statement;

SET @auth_version_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'user_accounts'
    AND COLUMN_NAME = 'auth_version'
);
SET @auth_version_sql = IF(
  @auth_version_exists = 0,
  'ALTER TABLE user_accounts ADD COLUMN auth_version INT UNSIGNED NOT NULL DEFAULT 1 AFTER reset_token_hash',
  'SELECT 1'
);
PREPARE auth_version_statement FROM @auth_version_sql;
EXECUTE auth_version_statement;
DEALLOCATE PREPARE auth_version_statement;

-- Links issued before this migration used hash_auth and cannot be safely distinguished
-- from remember-me tokens. Expire those links without invalidating remember-me cookies.
UPDATE user_accounts
SET reset_token_expires = NULL,
    last_reset_request = NULL
WHERE reset_token_expires IS NOT NULL;
