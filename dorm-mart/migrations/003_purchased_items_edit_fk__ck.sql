-- Step 1: Drop existing RESTRICT constraints (keep names so we can reuse them)
ALTER TABLE purchased_items
  DROP FOREIGN KEY fk_purchased_items_buyer,    -- remove old buyer FK
  DROP FOREIGN KEY fk_purchased_items_seller;   -- remove old seller FK

-- Step 2: Re-add the constraints with ON DELETE CASCADE
ALTER TABLE purchased_items
  ADD CONSTRAINT fk_purchased_items_buyer       -- keep stable name
    FOREIGN KEY (buyer_user_id)                 -- child column
    REFERENCES user_accounts(user_id)           -- parent PK
    ON DELETE CASCADE                           -- delete child rows when parent user is deleted
    ON UPDATE CASCADE,                          -- keep in place
  ADD CONSTRAINT fk_purchased_items_seller
    FOREIGN KEY (seller_user_id)
    REFERENCES user_accounts(user_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE;