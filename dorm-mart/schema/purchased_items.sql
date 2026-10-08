-- Purchases recorded before purchase_history existed. Nothing writes here any
-- more; purchase_history.php still shows these rows. item_id is this table's
-- own counter, not a listing id.

CREATE TABLE purchased_items (
  item_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  title VARCHAR(200) NOT NULL,
  sold_by VARCHAR(100) NOT NULL,
  transacted_at DATETIME NOT NULL,
  buyer_user_id BIGINT UNSIGNED NULL,
  seller_user_id BIGINT UNSIGNED NULL,
  image_url VARCHAR(500) DEFAULT NULL,

  PRIMARY KEY (item_id),
  KEY idx_transacted_at (transacted_at),
  KEY idx_buyer_user_id (buyer_user_id),
  KEY idx_seller_user_id (seller_user_id),
  CONSTRAINT fk_purchased_items_buyer
    FOREIGN KEY (buyer_user_id) REFERENCES user_accounts(user_id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_purchased_items_seller
    FOREIGN KEY (seller_user_id) REFERENCES user_accounts(user_id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
