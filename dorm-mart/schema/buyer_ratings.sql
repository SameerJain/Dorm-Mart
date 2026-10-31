-- A seller's rating of the buyer they sold to.

CREATE TABLE buyer_ratings (
  rating_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id BIGINT UNSIGNED NOT NULL,
  seller_user_id BIGINT UNSIGNED NOT NULL,
  buyer_user_id BIGINT UNSIGNED NOT NULL,
  rating DECIMAL(2,1) NOT NULL,
  review_text TEXT NOT NULL COMMENT 'Review text from seller about buyer experience',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (rating_id),
  UNIQUE KEY uq_seller_buyer_product_rating (seller_user_id, buyer_user_id, product_id),
  INDEX idx_product_id (product_id),
  INDEX idx_buyer_user_id (buyer_user_id),
  INDEX idx_rating (rating),
  INDEX idx_created_at (created_at),
  CONSTRAINT fk_buyer_rating_product
    FOREIGN KEY (product_id) REFERENCES INVENTORY(product_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_buyer_rating_seller
    FOREIGN KEY (seller_user_id) REFERENCES user_accounts(user_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_buyer_rating_buyer
    FOREIGN KEY (buyer_user_id) REFERENCES user_accounts(user_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT chk_buyer_rating_range CHECK (rating >= 0 AND rating <= 5),
  CONSTRAINT chk_buyer_rating_increment CHECK (rating * 2 = FLOOR(rating * 2))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
