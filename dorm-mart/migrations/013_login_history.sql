-- Successful account logins used by the Logged Devices settings page.

CREATE TABLE IF NOT EXISTS login_history (
  login_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  session_hash CHAR(64) NOT NULL,
  device_type VARCHAR(20) NOT NULL,
  browser VARCHAR(80) NOT NULL,
  operating_system VARCHAR(80) NOT NULL,
  user_agent VARCHAR(512) NOT NULL,
  ip_address VARCHAR(45) NOT NULL,
  location VARCHAR(160) NULL DEFAULT NULL,
  logged_in_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  signed_out_at DATETIME NULL DEFAULT NULL,

  PRIMARY KEY (login_id),
  UNIQUE KEY uq_login_history_session (session_hash),
  INDEX idx_login_history_user_seen (user_id, last_seen_at),
  CONSTRAINT fk_login_history_user
    FOREIGN KEY (user_id) REFERENCES user_accounts(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
