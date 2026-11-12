CREATE TABLE browser_push_subscriptions (
  subscription_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  login_id BIGINT UNSIGNED NOT NULL,
  auth_version INT UNSIGNED NOT NULL,
  endpoint TEXT NOT NULL,
  endpoint_hash CHAR(64) NOT NULL,
  public_key VARCHAR(100) NOT NULL,
  auth_token VARCHAR(30) NOT NULL,
  PRIMARY KEY (subscription_id),
  UNIQUE KEY uq_push_endpoint (endpoint_hash),
  INDEX idx_push_user (user_id),
  CONSTRAINT fk_push_user FOREIGN KEY (user_id) REFERENCES user_accounts(user_id) ON DELETE CASCADE,
  CONSTRAINT fk_push_login FOREIGN KEY (login_id) REFERENCES login_history(login_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
