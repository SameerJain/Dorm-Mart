
CREATE TABLE IF NOT EXISTS purchased_items (
  item_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,   
  title VARCHAR(200) NOT NULL,                 
  sold_by VARCHAR(100) NOT NULL,                
  transacted_at DATETIME NOT NULL,
  buyer_user_id  BIGINT UNSIGNED NOT NULL,
  seller_user_id BIGINT UNSIGNED NOT NULL,   
  image_url VARCHAR(500) DEFAULT NULL,               
  KEY idx_transacted_at (transacted_at),
  KEY idx_buyer_user_id  (buyer_user_id),
  KEY idx_seller_user_id (seller_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;