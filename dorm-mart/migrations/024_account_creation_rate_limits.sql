-- Source-based throttling for account-creation requests.

CREATE TABLE IF NOT EXISTS account_creation_rate_limits (
  rate_limit_key CHAR(64) NOT NULL,
  attempt_count TINYINT UNSIGNED NOT NULL DEFAULT 0,
  last_attempt_at DATETIME NULL DEFAULT NULL,
  lockout_until DATETIME NULL DEFAULT NULL,

  PRIMARY KEY (rate_limit_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
