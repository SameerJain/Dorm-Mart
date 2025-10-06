-- add fk columns
ALTER TABLE transacted_items
  ADD COLUMN buyer_user_id  INT UNSIGNED NOT NULL,
  ADD COLUMN seller_user_id INT UNSIGNED NOT NULL,
  ADD KEY idx_buyer_user_id  (buyer_user_id),
  ADD KEY idx_seller_user_id (seller_user_id);

-- add foreign keys (keep names stable for future drops/changes)
-- ALTER TABLE purchased_items
--   ADD CONSTRAINT fk_purchased_items_buyer
--     FOREIGN KEY (buyer_user_id)  REFERENCES users(id)
--     ON DELETE RESTRICT ON UPDATE CASCADE,
--   ADD CONSTRAINT fk_purchased_items_seller
--     FOREIGN KEY (seller_user_id) REFERENCES users(id)
--     ON DELETE RESTRICT ON UPDATE CASCADE;