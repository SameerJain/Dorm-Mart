-- Manual Database Sync Script
-- Run this to sync your local database with migrations 013, 014, 015
-- This handles cases where these migrations may have been partially applied

-- ============================================================================
-- Migration 013: Create scheduled_purchase_requests table
-- ============================================================================
CREATE TABLE IF NOT EXISTS scheduled_purchase_requests (
    request_id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    inventory_product_id BIGINT UNSIGNED NOT NULL,
    seller_user_id       BIGINT UNSIGNED NOT NULL,
    buyer_user_id        BIGINT UNSIGNED NOT NULL,
    conversation_id      BIGINT DEFAULT NULL,
    meet_location        VARCHAR(255) NOT NULL,
    meeting_at           DATETIME NOT NULL,
    verification_code    CHAR(4) NOT NULL,
    description          TEXT NULL DEFAULT NULL,
    status               ENUM('pending', 'accepted', 'declined', 'cancelled') NOT NULL DEFAULT 'pending',
    buyer_response_at    DATETIME DEFAULT NULL,
    created_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uq_scheduled_purchase_code (verification_code),
    INDEX idx_scheduled_purchase_seller (seller_user_id),
    INDEX idx_scheduled_purchase_buyer (buyer_user_id),
    INDEX idx_scheduled_purchase_status (status),
    INDEX idx_scheduled_purchase_meeting_at (meeting_at),

    CONSTRAINT fk_sched_purchase_inventory
        FOREIGN KEY (inventory_product_id)
        REFERENCES INVENTORY(product_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_sched_purchase_seller
        FOREIGN KEY (seller_user_id)
        REFERENCES user_accounts(user_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_sched_purchase_buyer
        FOREIGN KEY (buyer_user_id)
        REFERENCES user_accounts(user_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_sched_purchase_conversation
        FOREIGN KEY (conversation_id)
        REFERENCES conversations(conv_id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Migration 014: Add metadata column to messages table
-- ============================================================================
-- Check if column exists before adding
SET @dbname = DATABASE();
SET @tablename = 'messages';
SET @columnname = 'metadata';
SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE
            (TABLE_SCHEMA = @dbname)
            AND (TABLE_NAME = @tablename)
            AND (COLUMN_NAME = @columnname)
    ) > 0,
    'SELECT 1',
    CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' TEXT NULL DEFAULT NULL AFTER content')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- ============================================================================
-- Migration 015: Add product_id to conversations table
-- ============================================================================
-- Check if column exists before adding
SET @dbname = DATABASE();
SET @tablename = 'conversations';
SET @columnname = 'product_id';
SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE
            (TABLE_SCHEMA = @dbname)
            AND (TABLE_NAME = @tablename)
            AND (COLUMN_NAME = @columnname)
    ) > 0,
    'SELECT 1',
    CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' BIGINT UNSIGNED NULL DEFAULT NULL AFTER user2_id')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add foreign key constraint if it doesn't exist
SET @constraint_name = 'fk_conv_product';
SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
        WHERE
            (TABLE_SCHEMA = @dbname)
            AND (TABLE_NAME = @tablename)
            AND (CONSTRAINT_NAME = @constraint_name)
    ) > 0,
    'SELECT 1',
    CONCAT('ALTER TABLE ', @tablename, ' ADD CONSTRAINT ', @constraint_name, 
           ' FOREIGN KEY (product_id) REFERENCES INVENTORY(product_id) ON DELETE SET NULL ON UPDATE CASCADE')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add unique index if it doesn't exist
SET @index_name = 'uq_conv_users_product';
SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE
            (TABLE_SCHEMA = @dbname)
            AND (TABLE_NAME = @tablename)
            AND (INDEX_NAME = @index_name)
    ) > 0,
    'SELECT 1',
    CONCAT('ALTER TABLE ', @tablename, ' ADD UNIQUE KEY ', @index_name, ' (user1_id, user2_id, product_id)')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;
