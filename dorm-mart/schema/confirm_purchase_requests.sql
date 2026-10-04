-- The seller's Confirm Purchase form; the buyer accepts, declines, or it
-- auto-accepts at expires_at.

CREATE TABLE confirm_purchase_requests (
  confirm_request_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  scheduled_request_id BIGINT UNSIGNED NOT NULL,
  inventory_product_id BIGINT UNSIGNED NULL,
  seller_user_id BIGINT UNSIGNED NULL,
  buyer_user_id BIGINT UNSIGNED NULL,
  conversation_id BIGINT NOT NULL,
  is_successful BOOLEAN NOT NULL DEFAULT TRUE,
  final_price DECIMAL(10,2) NULL DEFAULT NULL,
  seller_notes TEXT NULL DEFAULT NULL,
  failure_reason ENUM('buyer_no_show','insufficient_funds','other') NULL DEFAULT NULL,
  failure_reason_notes TEXT NULL DEFAULT NULL,
  status ENUM('pending','buyer_accepted','buyer_declined','auto_accepted','payment_completed','seller_cancelled') NOT NULL DEFAULT 'pending',
  completion_source ENUM('manual','stripe') NOT NULL DEFAULT 'manual',
  electronic_payment_id BIGINT UNSIGNED NULL DEFAULT NULL,
  -- Set only while this confirmation is a successful sale, so a schedule can
  -- have at most one (the unique key below).
  successful_schedule_id BIGINT UNSIGNED GENERATED ALWAYS AS (
    CASE
      WHEN is_successful = 1 AND status IN ('buyer_accepted','auto_accepted','payment_completed')
      THEN scheduled_request_id
      ELSE NULL
    END
  ) STORED,
  expires_at DATETIME NOT NULL,
  buyer_response_at DATETIME NULL DEFAULT NULL,
  auto_processed_at DATETIME NULL DEFAULT NULL,
  payload_snapshot JSON NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (confirm_request_id),
  INDEX idx_confirm_sched (scheduled_request_id),
  INDEX idx_confirm_inventory (inventory_product_id),
  INDEX idx_confirm_status (status),
  INDEX idx_confirm_expires_at (expires_at),
  UNIQUE KEY uq_confirm_successful_schedule (successful_schedule_id),
  UNIQUE KEY uq_confirm_electronic_payment (electronic_payment_id),
  CONSTRAINT fk_confirm_sched
    FOREIGN KEY (scheduled_request_id) REFERENCES scheduled_purchase_requests(request_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_confirm_inventory
    FOREIGN KEY (inventory_product_id) REFERENCES INVENTORY(product_id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_confirm_seller
    FOREIGN KEY (seller_user_id) REFERENCES user_accounts(user_id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_confirm_buyer
    FOREIGN KEY (buyer_user_id) REFERENCES user_accounts(user_id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_confirm_electronic_payment
    FOREIGN KEY (electronic_payment_id) REFERENCES electronic_payments(electronic_payment_id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_confirm_conversation
    FOREIGN KEY (conversation_id) REFERENCES conversations(conv_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT chk_confirm_payload_valid CHECK (payload_snapshot IS NULL OR JSON_VALID(payload_snapshot)),
  CONSTRAINT chk_confirm_final_price CHECK (final_price IS NULL OR final_price >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
