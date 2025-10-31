-- 011_add_item_status.sql
-- Adds item_status to INVENTORY and backfills from existing sold flag

ALTER TABLE INVENTORY
  ADD COLUMN item_status ENUM('Active','Pending','Draft','Sold') NOT NULL DEFAULT 'Active' AFTER listing_price,
  ADD INDEX idx_item_status (item_status);

-- Backfill from existing sold flag
UPDATE INVENTORY SET item_status = 'Sold'  WHERE sold = 1;
UPDATE INVENTORY SET item_status = 'Active' WHERE sold = 0 OR sold IS NULL;


