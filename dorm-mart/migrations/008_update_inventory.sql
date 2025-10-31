-- 008_update_inventory.sql
-- Rename columns in INVENTORY table:
--   tags -> categories
--   meet_location -> item_location

ALTER TABLE INVENTORY
    CHANGE COLUMN `tags` `categories` JSON DEFAULT NULL,
    CHANGE COLUMN `meet_location` `item_location` VARCHAR(100) DEFAULT NULL;
