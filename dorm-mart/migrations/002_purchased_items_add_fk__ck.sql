-- add foreign keys (keep names stable for future drops/changes)
ALTER TABLE purchased_items
  ADD CONSTRAINT fk_purchased_items_buyer
    FOREIGN KEY (buyer_user_id)  REFERENCES user_accounts(user_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT fk_purchased_items_seller
    FOREIGN KEY (seller_user_id) REFERENCES user_accounts(user_id)
    ON DELETE RESTRICT ON UPDATE CASCADE;