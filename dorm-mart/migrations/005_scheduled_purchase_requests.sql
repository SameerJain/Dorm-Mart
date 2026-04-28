-- Scheduled purchase requests between buyers and sellers.

CREATE TABLE IF NOT EXISTS scheduled_purchase_requests (
  request_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  inventory_product_id BIGINT UNSIGNED NOT NULL,
  seller_user_id BIGINT UNSIGNED NOT NULL,
  buyer_user_id BIGINT UNSIGNED NOT NULL,
  conversation_id BIGINT DEFAULT NULL,
  meet_location VARCHAR(255) NOT NULL,
  meeting_at DATETIME NOT NULL,
  verification_code CHAR(4) NOT NULL,
  description TEXT NULL DEFAULT NULL,
  negotiated_price DECIMAL(10,2) NULL DEFAULT NULL,
  is_trade BOOLEAN NOT NULL DEFAULT FALSE,
  trade_item_description TEXT NULL DEFAULT NULL,
  snapshot_price_nego BOOLEAN NOT NULL DEFAULT FALSE,
  snapshot_trades BOOLEAN NOT NULL DEFAULT FALSE,
  snapshot_meet_location VARCHAR(255) NULL DEFAULT NULL,
  status ENUM('pending','accepted','declined','cancelled','expired') NOT NULL DEFAULT 'pending',
  canceled_by_user_id BIGINT UNSIGNED NULL DEFAULT NULL,
  buyer_response_at DATETIME DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (request_id),
  UNIQUE KEY uq_scheduled_purchase_code (verification_code),
  INDEX idx_scheduled_purchase_seller (seller_user_id),
  INDEX idx_scheduled_purchase_buyer (buyer_user_id),
  INDEX idx_scheduled_purchase_status (status),
  INDEX idx_scheduled_purchase_meeting_at (meeting_at),
  INDEX idx_scheduled_purchase_canceled_by (canceled_by_user_id),
  CONSTRAINT fk_sched_purchase_inventory
    FOREIGN KEY (inventory_product_id)
    REFERENCES INVENTORY(product_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_sched_purchase_seller
    FOREIGN KEY (seller_user_id)
    REFERENCES user_accounts(user_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_sched_purchase_buyer
    FOREIGN KEY (buyer_user_id)
    REFERENCES user_accounts(user_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_sched_purchase_conversation
    FOREIGN KEY (conversation_id)
    REFERENCES conversations(conv_id)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT fk_sched_purchase_canceled_by
    FOREIGN KEY (canceled_by_user_id)
    REFERENCES user_accounts(user_id)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
