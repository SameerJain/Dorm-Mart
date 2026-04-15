-- 008_update_inventory.sql (idempotent)
-- Rename legacy columns when present:
--   tags -> categories
--   meet_location -> item_location
-- Skips each step if the source column is already gone (e.g. DB created with newer 006).

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'INVENTORY'
     AND COLUMN_NAME = 'tags') > 0,
    'ALTER TABLE INVENTORY CHANGE COLUMN `tags` `categories` JSON DEFAULT NULL',
    'SELECT "INVENTORY.tags already absent or renamed"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'INVENTORY'
     AND COLUMN_NAME = 'meet_location') > 0,
    'ALTER TABLE INVENTORY CHANGE COLUMN `meet_location` `item_location` VARCHAR(100) DEFAULT NULL',
    'SELECT "INVENTORY.meet_location already absent or renamed"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
