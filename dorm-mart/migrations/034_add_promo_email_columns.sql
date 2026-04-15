-- Add promo email tracking column to user_accounts table (idempotent)
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'user_accounts'
     AND COLUMN_NAME = 'received_intro_promo_email') = 0,
    'ALTER TABLE user_accounts ADD COLUMN received_intro_promo_email BOOLEAN NOT NULL DEFAULT FALSE',
    'SELECT "Column received_intro_promo_email already exists"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
