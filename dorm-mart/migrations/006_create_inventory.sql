-- 001_create_inventory.sql
-- Creates the INVENTORY table to store product listings

CREATE TABLE IF NOT EXISTS INVENTORY (
    product_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    tags JSON DEFAULT NULL,                     -- list of strings, e.g. ["Blue","Dorm"]
    meet_location VARCHAR(100) DEFAULT NULL,
    item_condition VARCHAR(100) DEFAULT NULL,
    description TEXT DEFAULT NULL,
    photos JSON DEFAULT NULL,                   -- list of image URLs or file paths
    listing_price FLOAT DEFAULT 0,
    trades BOOLEAN DEFAULT FALSE,
    price_nego BOOLEAN DEFAULT FALSE,
    date_listed DATE DEFAULT (CURRENT_DATE),
    seller_id BIGINT UNSIGNED NOT NULL,
    sold BOOLEAN DEFAULT FALSE,
    final_price FLOAT DEFAULT NULL,
    date_sold DATE DEFAULT NULL,
    sold_to BIGINT UNSIGNED DEFAULT NULL,
    
    -- Relationships and performance
    INDEX idx_seller_id (seller_id),
    INDEX idx_sold_to (sold_to),
    INDEX idx_sold (sold),
    INDEX idx_date_listed (date_listed)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
