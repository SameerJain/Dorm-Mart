-- Wishlist state and seller notification counts.

CREATE TABLE IF NOT EXISTS wishlist (
  wishlist_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (wishlist_id),
  UNIQUE KEY uq_user_product (user_id, product_id),
  INDEX idx_user_id (user_id),
  INDEX idx_product_id (product_id),
  CONSTRAINT fk_wishlist_user
    FOREIGN KEY (user_id)
    REFERENCES user_accounts(user_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_wishlist_product
    FOREIGN KEY (product_id)
    REFERENCES INVENTORY(product_id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS wishlist_notification (
  seller_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(255) NOT NULL,
  image_url VARCHAR(255) DEFAULT NULL,
  unread_count INT UNSIGNED NOT NULL DEFAULT 0,

  PRIMARY KEY (seller_id, product_id),
  INDEX idx_wn_product_id (product_id),
  INDEX idx_wn_seller_id (seller_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
