-- Track product-detail views for seller dashboard statistics.

ALTER TABLE INVENTORY
  ADD COLUMN view_count INT UNSIGNED NOT NULL DEFAULT 0 AFTER wishlisted;
