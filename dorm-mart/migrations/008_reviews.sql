-- Product reviews and seller ratings for buyers.

CREATE TABLE IF NOT EXISTS product_reviews (
  review_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id BIGINT UNSIGNED NOT NULL,
  buyer_user_id BIGINT UNSIGNED NOT NULL,
  seller_user_id BIGINT UNSIGNED NOT NULL,
  rating DECIMAL(2,1) NOT NULL,
  product_rating DECIMAL(2,1) NULL DEFAULT NULL,
  review_text TEXT NOT NULL,
  image1_url TEXT NULL,
  image2_url TEXT NULL,
  image3_url TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (review_id),
  UNIQUE KEY uq_buyer_product_review (buyer_user_id, product_id),
  INDEX idx_product_id (product_id),
  INDEX idx_buyer_user_id (buyer_user_id),
  INDEX idx_seller_user_id (seller_user_id),
  INDEX idx_rating (rating),
  INDEX idx_created_at (created_at),
  CONSTRAINT fk_review_product
    FOREIGN KEY (product_id)
    REFERENCES INVENTORY(product_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_review_buyer
    FOREIGN KEY (buyer_user_id)
    REFERENCES user_accounts(user_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_review_seller
    FOREIGN KEY (seller_user_id)
    REFERENCES user_accounts(user_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT chk_rating_range CHECK (rating >= 0 AND rating <= 5),
  CONSTRAINT chk_rating_increment CHECK (rating * 2 = FLOOR(rating * 2))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS buyer_ratings (
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
  INDEX idx_seller_user_id (seller_user_id),
  INDEX idx_buyer_user_id (buyer_user_id),
  INDEX idx_rating (rating),
  INDEX idx_created_at (created_at),
  CONSTRAINT fk_buyer_rating_product
    FOREIGN KEY (product_id)
    REFERENCES INVENTORY(product_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_buyer_rating_seller
    FOREIGN KEY (seller_user_id)
    REFERENCES user_accounts(user_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_buyer_rating_buyer
    FOREIGN KEY (buyer_user_id)
    REFERENCES user_accounts(user_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT chk_buyer_rating_range CHECK (rating >= 0 AND rating <= 5),
  CONSTRAINT chk_buyer_rating_increment CHECK (rating * 2 = FLOOR(rating * 2))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
