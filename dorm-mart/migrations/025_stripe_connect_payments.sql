-- Stripe Connect payment accounts and electronic payments for Scheduled Purchases.

CREATE TABLE IF NOT EXISTS connected_payment_accounts (
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

SET @scheduled_payment_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'scheduled_purchase_requests'
    AND COLUMN_NAME = 'payment_option'
);
SET @scheduled_payment_sql = IF(
  @scheduled_payment_exists = 0,
  'ALTER TABLE scheduled_purchase_requests
    ADD COLUMN payment_option ENUM(''manual'',''stripe'') NOT NULL DEFAULT ''manual'' AFTER trade_item_description,
    ADD COLUMN payment_amount_cents INT UNSIGNED NULL DEFAULT NULL AFTER payment_option,
    ADD COLUMN payment_mode ENUM(''test'',''live'') NULL DEFAULT NULL AFTER payment_amount_cents,
    ADD COLUMN payment_fallback_at DATETIME NULL DEFAULT NULL AFTER payment_mode,
    ADD COLUMN payment_fallback_reason VARCHAR(64) NULL DEFAULT NULL AFTER payment_fallback_at,
    ADD COLUMN payment_fallback_notified_at DATETIME NULL DEFAULT NULL AFTER payment_fallback_reason,
    ADD INDEX idx_scheduled_payment_window (payment_option, payment_mode, meeting_at),
    ADD CONSTRAINT chk_scheduled_stripe_payment CHECK (
      payment_option <> ''stripe'' OR (
        payment_amount_cents BETWEEN 50 AND 999999 AND payment_mode IS NOT NULL AND is_trade = 0
      )
    )',
  'SELECT 1'
);
PREPARE scheduled_payment_statement FROM @scheduled_payment_sql;
EXECUTE scheduled_payment_statement;
DEALLOCATE PREPARE scheduled_payment_statement;

CREATE TABLE IF NOT EXISTS electronic_payments (
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

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  webhook_event_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  payment_mode ENUM('test','live') NOT NULL,
  stripe_event_id VARCHAR(255) NOT NULL,
  event_type VARCHAR(128) NOT NULL,
  stripe_object_id VARCHAR(255) NULL DEFAULT NULL,
  processed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (webhook_event_id),
  UNIQUE KEY uq_stripe_webhook_event (payment_mode, stripe_event_id),
  INDEX idx_stripe_webhook_object (stripe_object_id, event_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @confirm_payment_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'confirm_purchase_requests'
    AND COLUMN_NAME = 'completion_source'
);
SET @confirm_payment_sql = IF(
  @confirm_payment_exists = 0,
  'ALTER TABLE confirm_purchase_requests
    MODIFY COLUMN status ENUM(
      ''pending'', ''buyer_accepted'', ''buyer_declined'', ''auto_accepted'', ''payment_completed'', ''seller_cancelled''
    ) NOT NULL DEFAULT ''pending'',
    ADD COLUMN completion_source ENUM(''manual'',''stripe'') NOT NULL DEFAULT ''manual'' AFTER status,
    ADD COLUMN electronic_payment_id BIGINT UNSIGNED NULL DEFAULT NULL AFTER completion_source,
    ADD COLUMN successful_schedule_id BIGINT UNSIGNED GENERATED ALWAYS AS (
      CASE
        WHEN is_successful = 1 AND status IN (''buyer_accepted'',''auto_accepted'',''payment_completed'')
        THEN scheduled_request_id
        ELSE NULL
      END
    ) STORED,
    ADD UNIQUE KEY uq_confirm_successful_schedule (successful_schedule_id),
    ADD UNIQUE KEY uq_confirm_electronic_payment (electronic_payment_id),
    ADD CONSTRAINT fk_confirm_electronic_payment
      FOREIGN KEY (electronic_payment_id) REFERENCES electronic_payments(electronic_payment_id)
      ON DELETE SET NULL ON UPDATE CASCADE',
  'SELECT 1'
);
PREPARE confirm_payment_statement FROM @confirm_payment_sql;
EXECUTE confirm_payment_statement;
DEALLOCATE PREPARE confirm_payment_statement;
