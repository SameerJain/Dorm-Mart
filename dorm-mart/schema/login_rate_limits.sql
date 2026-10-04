-- Throttle buckets for login, 2FA issuance, account creation and other flows.
-- session_id holds an opaque (usually hashed) key namespaced by flow.

CREATE TABLE login_rate_limits (
  session_id VARCHAR(128) NOT NULL,
  failed_login_attempts INT UNSIGNED NOT NULL DEFAULT 0,
  last_failed_attempt TIMESTAMP NULL DEFAULT NULL,
  lockout_until DATETIME NULL DEFAULT NULL COMMENT 'When the lockout expires',

  PRIMARY KEY (session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
