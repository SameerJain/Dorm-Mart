-- Product listings.

CREATE TABLE IF NOT EXISTS INVENTORY (
  product_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  title VARCHAR(255) NOT NULL,
  categories JSON DEFAULT NULL,
  item_location VARCHAR(100) DEFAULT NULL,
  item_condition VARCHAR(100) DEFAULT NULL,
  description TEXT DEFAULT NULL,
  photos JSON DEFAULT NULL,
  listing_price FLOAT DEFAULT 0,
  item_status ENUM('Active','Pending','Draft','Sold') NOT NULL DEFAULT 'Active',
  trades BOOLEAN DEFAULT FALSE,
  price_nego BOOLEAN DEFAULT FALSE,
  date_listed DATE DEFAULT (CURRENT_DATE),
  seller_id BIGINT UNSIGNED NOT NULL,
  sold BOOLEAN DEFAULT FALSE,
  final_price FLOAT DEFAULT NULL,
  date_sold DATE DEFAULT NULL,
  sold_to BIGINT UNSIGNED DEFAULT NULL,
  wishlisted INT UNSIGNED NOT NULL DEFAULT 0,

  PRIMARY KEY (product_id),
  INDEX idx_seller_id (seller_id),
  INDEX idx_sold_to (sold_to),
  INDEX idx_sold (sold),
  INDEX idx_item_status (item_status),
  INDEX idx_date_listed (date_listed)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
