-- Hard account deletion guard and nullable shared-record references.

ALTER TABLE user_accounts
  ADD COLUMN is_protected TINYINT(1) NOT NULL DEFAULT 0 AFTER hash_auth;

ALTER TABLE conversations
  MODIFY user1_id BIGINT UNSIGNED NULL,
  MODIFY user2_id BIGINT UNSIGNED NULL;

ALTER TABLE messages
  DROP FOREIGN KEY fk_msg_sender,
  DROP FOREIGN KEY fk_msg_receiver,
  MODIFY sender_id BIGINT UNSIGNED NULL,
  MODIFY receiver_id BIGINT UNSIGNED NULL;

ALTER TABLE messages
  ADD CONSTRAINT fk_msg_sender
    FOREIGN KEY (sender_id) REFERENCES user_accounts(user_id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_msg_receiver
    FOREIGN KEY (receiver_id) REFERENCES user_accounts(user_id) ON DELETE SET NULL;

ALTER TABLE purchased_items
  DROP FOREIGN KEY fk_purchased_items_buyer,
  DROP FOREIGN KEY fk_purchased_items_seller,
  MODIFY buyer_user_id BIGINT UNSIGNED NULL,
  MODIFY seller_user_id BIGINT UNSIGNED NULL;

ALTER TABLE purchased_items
  ADD CONSTRAINT fk_purchased_items_buyer
    FOREIGN KEY (buyer_user_id) REFERENCES user_accounts(user_id) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT fk_purchased_items_seller
    FOREIGN KEY (seller_user_id) REFERENCES user_accounts(user_id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE scheduled_purchase_requests
  DROP FOREIGN KEY fk_sched_purchase_inventory,
  DROP FOREIGN KEY fk_sched_purchase_seller,
  DROP FOREIGN KEY fk_sched_purchase_buyer,
  MODIFY inventory_product_id BIGINT UNSIGNED NULL,
  MODIFY seller_user_id BIGINT UNSIGNED NULL,
  MODIFY buyer_user_id BIGINT UNSIGNED NULL;

ALTER TABLE scheduled_purchase_requests
  ADD CONSTRAINT fk_sched_purchase_inventory
    FOREIGN KEY (inventory_product_id) REFERENCES INVENTORY(product_id) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT fk_sched_purchase_seller
    FOREIGN KEY (seller_user_id) REFERENCES user_accounts(user_id) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT fk_sched_purchase_buyer
    FOREIGN KEY (buyer_user_id) REFERENCES user_accounts(user_id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE confirm_purchase_requests
  DROP FOREIGN KEY fk_confirm_inventory,
  DROP FOREIGN KEY fk_confirm_seller,
  DROP FOREIGN KEY fk_confirm_buyer,
  MODIFY inventory_product_id BIGINT UNSIGNED NULL,
  MODIFY seller_user_id BIGINT UNSIGNED NULL,
  MODIFY buyer_user_id BIGINT UNSIGNED NULL;

ALTER TABLE confirm_purchase_requests
  ADD CONSTRAINT fk_confirm_inventory
    FOREIGN KEY (inventory_product_id) REFERENCES INVENTORY(product_id) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT fk_confirm_seller
    FOREIGN KEY (seller_user_id) REFERENCES user_accounts(user_id) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT fk_confirm_buyer
    FOREIGN KEY (buyer_user_id) REFERENCES user_accounts(user_id) ON DELETE SET NULL ON UPDATE CASCADE;
