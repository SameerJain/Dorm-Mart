-- Reconcile databases that applied an earlier 021 revision before deployment.

ALTER TABLE user_accounts
  MODIFY COLUMN reset_token_hash VARCHAR(255) NULL DEFAULT NULL,
  MODIFY COLUMN auth_version INT UNSIGNED NOT NULL DEFAULT 1;

UPDATE user_accounts
SET reset_token_expires = NULL,
    last_reset_request = NULL
WHERE reset_token_expires IS NOT NULL;
