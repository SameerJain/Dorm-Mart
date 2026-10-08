-- One electronic payment per Scheduled Purchase request.

CREATE TABLE electronic_payments (
  electronic_payment_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  scheduled_request_id BIGINT UNSIGNED NOT NULL,
  connected_payment_account_id BIGINT UNSIGNED NULL DEFAULT NULL,
  seller_user_id BIGINT UNSIGNED NULL DEFAULT NULL,
  buyer_user_id BIGINT UNSIGNED NULL DEFAULT NULL,
  payment_mode ENUM('test','live') NOT NULL,
  amount_cents INT UNSIGNED NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'usd',
  stripe_connected_account_id VARCHAR(255) NOT NULL,
  stripe_payment_intent_id VARCHAR(255) NOT NULL,
  stripe_charge_id VARCHAR(255) NULL DEFAULT NULL,
  stripe_refund_id VARCHAR(255) NULL DEFAULT NULL,
  stripe_dispute_id VARCHAR(255) NULL DEFAULT NULL,
  status ENUM(
    'requires_payment_method',
    'requires_action',
    'processing',
    'succeeded',
    'refund_pending',
    'refunded',
    'refund_failed',
    'canceled',
    'disputed'
  ) NOT NULL DEFAULT 'requires_payment_method',
  succeeded_at DATETIME NULL DEFAULT NULL,
  refund_requested_at DATETIME NULL DEFAULT NULL,
  refunded_at DATETIME NULL DEFAULT NULL,
  refund_relist BOOLEAN NULL DEFAULT NULL,
  refund_reason VARCHAR(64) NULL DEFAULT NULL,
  dispute_status VARCHAR(64) NULL DEFAULT NULL,
  last_error_code VARCHAR(128) NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (electronic_payment_id),
  UNIQUE KEY uq_electronic_payment_schedule (scheduled_request_id),
  UNIQUE KEY uq_electronic_payment_intent_mode (stripe_payment_intent_id, payment_mode),
  UNIQUE KEY uq_electronic_payment_charge_mode (stripe_charge_id, payment_mode),
  UNIQUE KEY uq_electronic_payment_refund_mode (stripe_refund_id, payment_mode),
  INDEX idx_electronic_payment_users (seller_user_id, buyer_user_id),
  INDEX idx_electronic_payment_status (status),
  CONSTRAINT fk_electronic_payment_schedule
    FOREIGN KEY (scheduled_request_id)
    REFERENCES scheduled_purchase_requests(request_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_electronic_payment_account
    FOREIGN KEY (connected_payment_account_id)
    REFERENCES connected_payment_accounts(payment_account_id)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT fk_electronic_payment_seller
    FOREIGN KEY (seller_user_id)
    REFERENCES user_accounts(user_id)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT fk_electronic_payment_buyer
    FOREIGN KEY (buyer_user_id)
    REFERENCES user_accounts(user_id)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT chk_electronic_payment_amount CHECK (amount_cents BETWEEN 50 AND 999999),
  CONSTRAINT chk_electronic_payment_currency CHECK (currency = 'usd')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
