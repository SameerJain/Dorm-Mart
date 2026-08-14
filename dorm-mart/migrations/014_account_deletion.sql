-- Hard account deletion guard and nullable shared-record references.

ALTER TABLE user_accounts
  ADD COLUMN IF NOT EXISTS is_protected TINYINT(1) NOT NULL DEFAULT 0 AFTER hash_auth;

ALTER TABLE conversations
  MODIFY user1_id BIGINT UNSIGNED NULL,
  MODIFY user2_id BIGINT UNSIGNED NULL;

ALTER TABLE messages
  DROP FOREIGN KEY IF EXISTS fk_msg_sender,
  DROP FOREIGN KEY IF EXISTS fk_msg_receiver,
  MODIFY sender_id BIGINT UNSIGNED NULL,
  MODIFY receiver_id BIGINT UNSIGNED NULL;

UPDATE messages m
LEFT JOIN user_accounts ua ON ua.user_id = m.sender_id
SET m.sender_id = NULL
WHERE m.sender_id IS NOT NULL AND ua.user_id IS NULL;

UPDATE messages m
LEFT JOIN user_accounts ua ON ua.user_id = m.receiver_id
SET m.receiver_id = NULL
WHERE m.receiver_id IS NOT NULL AND ua.user_id IS NULL;

ALTER TABLE messages
  ADD CONSTRAINT fk_msg_sender
    FOREIGN KEY (sender_id) REFERENCES user_accounts(user_id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_msg_receiver
    FOREIGN KEY (receiver_id) REFERENCES user_accounts(user_id) ON DELETE SET NULL;

ALTER TABLE purchased_items
  DROP FOREIGN KEY IF EXISTS fk_purchased_items_buyer,
  DROP FOREIGN KEY IF EXISTS fk_purchased_items_seller,
  MODIFY buyer_user_id BIGINT UNSIGNED NULL,
  MODIFY seller_user_id BIGINT UNSIGNED NULL;

UPDATE purchased_items p
LEFT JOIN user_accounts ua ON ua.user_id = p.buyer_user_id
SET p.buyer_user_id = NULL
WHERE p.buyer_user_id IS NOT NULL AND ua.user_id IS NULL;

UPDATE purchased_items p
LEFT JOIN user_accounts ua ON ua.user_id = p.seller_user_id
SET p.seller_user_id = NULL
WHERE p.seller_user_id IS NOT NULL AND ua.user_id IS NULL;

ALTER TABLE purchased_items
  ADD CONSTRAINT fk_purchased_items_buyer
    FOREIGN KEY (buyer_user_id) REFERENCES user_accounts(user_id) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT fk_purchased_items_seller
    FOREIGN KEY (seller_user_id) REFERENCES user_accounts(user_id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE scheduled_purchase_requests
  DROP FOREIGN KEY IF EXISTS fk_sched_purchase_inventory,
  DROP FOREIGN KEY IF EXISTS fk_sched_purchase_seller,
  DROP FOREIGN KEY IF EXISTS fk_sched_purchase_buyer,
  MODIFY inventory_product_id BIGINT UNSIGNED NULL,
  MODIFY seller_user_id BIGINT UNSIGNED NULL,
  MODIFY buyer_user_id BIGINT UNSIGNED NULL;

UPDATE scheduled_purchase_requests r
LEFT JOIN INVENTORY i ON i.product_id = r.inventory_product_id
SET r.inventory_product_id = NULL
WHERE r.inventory_product_id IS NOT NULL AND i.product_id IS NULL;

UPDATE scheduled_purchase_requests r
LEFT JOIN user_accounts ua ON ua.user_id = r.seller_user_id
SET r.seller_user_id = NULL
WHERE r.seller_user_id IS NOT NULL AND ua.user_id IS NULL;

UPDATE scheduled_purchase_requests r
LEFT JOIN user_accounts ua ON ua.user_id = r.buyer_user_id
SET r.buyer_user_id = NULL
WHERE r.buyer_user_id IS NOT NULL AND ua.user_id IS NULL;

ALTER TABLE scheduled_purchase_requests
  ADD CONSTRAINT fk_sched_purchase_inventory
    FOREIGN KEY (inventory_product_id) REFERENCES INVENTORY(product_id) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT fk_sched_purchase_seller
    FOREIGN KEY (seller_user_id) REFERENCES user_accounts(user_id) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT fk_sched_purchase_buyer
    FOREIGN KEY (buyer_user_id) REFERENCES user_accounts(user_id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE confirm_purchase_requests
  DROP FOREIGN KEY IF EXISTS fk_confirm_inventory,
  DROP FOREIGN KEY IF EXISTS fk_confirm_seller,
  DROP FOREIGN KEY IF EXISTS fk_confirm_buyer,
  MODIFY inventory_product_id BIGINT UNSIGNED NULL,
  MODIFY seller_user_id BIGINT UNSIGNED NULL,
  MODIFY buyer_user_id BIGINT UNSIGNED NULL;

UPDATE confirm_purchase_requests r
LEFT JOIN INVENTORY i ON i.product_id = r.inventory_product_id
SET r.inventory_product_id = NULL
WHERE r.inventory_product_id IS NOT NULL AND i.product_id IS NULL;

UPDATE confirm_purchase_requests r
LEFT JOIN user_accounts ua ON ua.user_id = r.seller_user_id
SET r.seller_user_id = NULL
WHERE r.seller_user_id IS NOT NULL AND ua.user_id IS NULL;

UPDATE confirm_purchase_requests r
LEFT JOIN user_accounts ua ON ua.user_id = r.buyer_user_id
SET r.buyer_user_id = NULL
WHERE r.buyer_user_id IS NOT NULL AND ua.user_id IS NULL;

ALTER TABLE confirm_purchase_requests
  ADD CONSTRAINT fk_confirm_inventory
    FOREIGN KEY (inventory_product_id) REFERENCES INVENTORY(product_id) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT fk_confirm_seller
    FOREIGN KEY (seller_user_id) REFERENCES user_accounts(user_id) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT fk_confirm_buyer
    FOREIGN KEY (buyer_user_id) REFERENCES user_accounts(user_id) ON DELETE SET NULL ON UPDATE CASCADE;
