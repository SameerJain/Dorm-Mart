-- Session-based login rate limiting.

CREATE TABLE IF NOT EXISTS login_rate_limits (
  session_id VARCHAR(128) NOT NULL,
  failed_login_attempts INT UNSIGNED NOT NULL DEFAULT 0,
  last_failed_attempt TIMESTAMP NULL DEFAULT NULL,
  lockout_until DATETIME NULL DEFAULT NULL COMMENT 'When the session lockout expires',

  PRIMARY KEY (session_id),
  INDEX idx_session_id (session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
