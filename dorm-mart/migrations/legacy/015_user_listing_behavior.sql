-- Preserve buyer engagement signals used to personalize the For You feed.

CREATE TABLE IF NOT EXISTS user_listing_behavior (
  user_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  view_count INT UNSIGNED NOT NULL DEFAULT 0,
  is_wishlisted BOOLEAN NOT NULL DEFAULT FALSE,
  last_interacted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (user_id, product_id),
  INDEX idx_behavior_user_updated (user_id, last_interacted_at),
  CONSTRAINT fk_behavior_user
    FOREIGN KEY (user_id)
    REFERENCES user_accounts(user_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_behavior_product
    FOREIGN KEY (product_id)
    REFERENCES INVENTORY(product_id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
