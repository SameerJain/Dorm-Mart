-- Purchase history tables.

CREATE TABLE IF NOT EXISTS purchased_items (
  item_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  title VARCHAR(200) NOT NULL,
  sold_by VARCHAR(100) NOT NULL,
  transacted_at DATETIME NOT NULL,
  buyer_user_id BIGINT UNSIGNED NOT NULL,
  seller_user_id BIGINT UNSIGNED NOT NULL,
  image_url VARCHAR(500) DEFAULT NULL,

  PRIMARY KEY (item_id),
  KEY idx_transacted_at (transacted_at),
  KEY idx_buyer_user_id (buyer_user_id),
  KEY idx_seller_user_id (seller_user_id),
  CONSTRAINT fk_purchased_items_buyer
    FOREIGN KEY (buyer_user_id)
    REFERENCES user_accounts(user_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_purchased_items_seller
    FOREIGN KEY (seller_user_id)
    REFERENCES user_accounts(user_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS purchase_history (
  history_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  items JSON NOT NULL DEFAULT (JSON_ARRAY()),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (history_id),
  UNIQUE KEY uq_purchase_history_user (user_id),
  INDEX idx_purchase_history_user (user_id),
  CONSTRAINT fk_purchase_history_user
    FOREIGN KEY (user_id)
    REFERENCES user_accounts(user_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT chk_purchase_history_items CHECK (JSON_VALID(items))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
