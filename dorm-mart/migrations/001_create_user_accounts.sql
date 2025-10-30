CREATE TABLE IF NOT EXISTS user_accounts (
  user_id        BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  first_name     VARCHAR(100)    NOT NULL,
  last_name      VARCHAR(100)    NOT NULL,

  -- Graduation Date (MM/YYYY)
  grad_month     TINYINT UNSIGNED NOT NULL,
  grad_year      YEAR             NOT NULL,

  email          VARCHAR(255)     NOT NULL,
  promotional    BOOLEAN          NOT NULL DEFAULT FALSE,

  hash_pass      VARCHAR(255)     NOT NULL,   -- password hash (e.g., bcrypt/argon2)
  hash_auth      VARCHAR(255)              DEFAULT NULL, -- auth/session/token hash if used

  -- Join Date (store as DATE; format DD/MM/YYYY is a display concern)
  join_date      DATE             NOT NULL DEFAULT (CURRENT_DATE),

  seller         BOOLEAN          NOT NULL DEFAULT FALSE,
  theme          BOOLEAN          NOT NULL DEFAULT FALSE,

  -- Rate limiting columns
  failed_login_attempts INT UNSIGNED NOT NULL DEFAULT 0,
  last_failed_attempt TIMESTAMP NULL DEFAULT NULL,

  -- Password reset columns
  reset_token_expires DATETIME NULL DEFAULT NULL,
  last_reset_request DATETIME NULL DEFAULT NULL,

  PRIMARY KEY (user_id),
  UNIQUE KEY uq_user_email (email),
  CHECK (grad_month BETWEEN 1 AND 12)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
