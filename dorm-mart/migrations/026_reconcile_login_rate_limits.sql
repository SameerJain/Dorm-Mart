-- Reconcile login_rate_limits on databases that already had a differently-shaped
-- table when 009 ran.
--
-- 009 uses CREATE TABLE IF NOT EXISTS, so a database that already held an older
-- login_rate_limits kept that older shape and still recorded 009 as applied. The
-- limiter then fails open in a way that is invisible from the outside:
-- check_rate_limit() and record_failed_attempt() reference lockout_until and
-- last_failed_attempt, so a missing column makes prepare() throw, both functions
-- swallow it and return "not blocked", while reset_failed_attempts() touches only
-- session_id and keeps succeeding -- so logins look perfectly healthy and no
-- lockout ever triggers. Observed on dormmart.me: unlimited failed logins, and a
-- correct password still accepted during what should be a lockout.
--
-- The table holds nothing but ephemeral counters, so recreating it is safe: the
-- worst case is that in-flight lockout windows reset once, at deploy time.

DROP TABLE IF EXISTS login_rate_limits;

CREATE TABLE login_rate_limits (
  session_id VARCHAR(128) NOT NULL,
  failed_login_attempts INT UNSIGNED NOT NULL DEFAULT 0,
  last_failed_attempt TIMESTAMP NULL DEFAULT NULL,
  lockout_until DATETIME NULL DEFAULT NULL COMMENT 'When the session lockout expires',

  PRIMARY KEY (session_id),
  INDEX idx_session_id (session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
