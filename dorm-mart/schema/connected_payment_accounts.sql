-- Stripe Connect accounts sellers link to receive payments.

CREATE TABLE connected_payment_accounts (
  payment_account_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  payment_mode ENUM('test','live') NOT NULL,
  stripe_account_id VARCHAR(255) NOT NULL,
  details_submitted BOOLEAN NOT NULL DEFAULT FALSE,
  charges_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  payouts_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  disconnected_at DATETIME NULL DEFAULT NULL,
  last_synced_at DATETIME NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (payment_account_id),
  UNIQUE KEY uq_payment_account_user_mode (user_id, payment_mode),
  UNIQUE KEY uq_payment_account_stripe_mode (stripe_account_id, payment_mode),
  INDEX idx_payment_account_ready (payment_mode, charges_enabled, payouts_enabled),
  CONSTRAINT fk_payment_account_user
    FOREIGN KEY (user_id)
    REFERENCES user_accounts(user_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
