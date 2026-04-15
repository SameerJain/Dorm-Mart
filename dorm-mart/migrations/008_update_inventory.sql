-- 008_update_inventory.sql (idempotent)
-- Rename legacy columns when present:
--   tags -> categories
--   meet_location -> item_location
-- Skips each step if the source column is already gone (e.g. DB created with newer 006).
-- Uses explicit counts + LOWER() matching so INFORMATION_SCHEMA agrees with ALTER TABLE
-- across table/column name casing (Linux vs Windows) and avoids CHANGE when the target
-- column already exists.

SET @inv_tags = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND LOWER(TABLE_NAME) = 'inventory'
      AND LOWER(COLUMN_NAME) = 'tags'
);
SET @inv_categories = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND LOWER(TABLE_NAME) = 'inventory'
      AND LOWER(COLUMN_NAME) = 'categories'
);
SET @tags_src = (
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND LOWER(TABLE_NAME) = 'inventory'
      AND LOWER(COLUMN_NAME) = 'tags'
    LIMIT 1
);
SET @sql = IF(
    @inv_tags > 0 AND @inv_categories = 0 AND @tags_src IS NOT NULL,
    CONCAT(
        'ALTER TABLE INVENTORY CHANGE COLUMN `',
        REPLACE(REPLACE(@tags_src, '`', ''), '\\', ''),
        '` `categories` JSON DEFAULT NULL'
    ),
    'SELECT "INVENTORY.tags already absent or renamed"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @inv_meet = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND LOWER(TABLE_NAME) = 'inventory'
      AND LOWER(COLUMN_NAME) = 'meet_location'
);
SET @inv_item_loc = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND LOWER(TABLE_NAME) = 'inventory'
      AND LOWER(COLUMN_NAME) = 'item_location'
);
SET @meet_src = (
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND LOWER(TABLE_NAME) = 'inventory'
      AND LOWER(COLUMN_NAME) = 'meet_location'
    LIMIT 1
);
SET @sql = IF(
    @inv_meet > 0 AND @inv_item_loc = 0 AND @meet_src IS NOT NULL,
    CONCAT(
        'ALTER TABLE INVENTORY CHANGE COLUMN `',
        REPLACE(REPLACE(@meet_src, '`', ''), '\\', ''),
        '` `item_location` VARCHAR(100) DEFAULT NULL'
    ),
    'SELECT "INVENTORY.meet_location already absent or renamed"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
