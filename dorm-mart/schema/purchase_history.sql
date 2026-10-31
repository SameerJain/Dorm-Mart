-- A buyer's completed purchases as a JSON list of
-- {product_id, recorded_at, confirm_payload} entries (see record_purchase_history).

CREATE TABLE purchase_history (
  history_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  items JSON NOT NULL DEFAULT (JSON_ARRAY()),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (history_id),
  UNIQUE KEY uq_purchase_history_user (user_id),
  CONSTRAINT fk_purchase_history_user
    FOREIGN KEY (user_id) REFERENCES user_accounts(user_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT chk_purchase_history_items CHECK (JSON_VALID(items))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
