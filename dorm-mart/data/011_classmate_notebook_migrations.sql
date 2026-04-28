-- Seed: Classmate Notebook end-to-end test story.
-- Purpose: creates a sold Classmate Notebook with chat, scheduled purchase, receipt, review, and purchase history.
-- Depends on: 008_testUserA-B.sql for testuserA@ and testuserB@.

START TRANSACTION;

SELECT user_id INTO @buyer_id
FROM user_accounts
WHERE email = 'testuserA@buffalo.edu'
LIMIT 1;

SELECT user_id INTO @seller_id
FROM user_accounts
WHERE email = 'testuserB@buffalo.edu'
LIMIT 1;

SELECT TRIM(CONCAT_WS(' ', first_name, last_name)) INTO @buyer_display
FROM user_accounts
WHERE user_id = @buyer_id
LIMIT 1;

SELECT TRIM(CONCAT_WS(' ', first_name, last_name)) INTO @seller_display
FROM user_accounts
WHERE user_id = @seller_id
LIMIT 1;

SET FOREIGN_KEY_CHECKS = 0;

-- Idempotent cleanup: anything tied to this listing title
DELETE cpr FROM confirm_purchase_requests cpr
INNER JOIN scheduled_purchase_requests spr ON spr.request_id = cpr.scheduled_request_id
INNER JOIN INVENTORY i ON i.product_id = spr.inventory_product_id
WHERE i.title = 'Classmate Notebook';

DELETE spr FROM scheduled_purchase_requests spr
INNER JOIN INVENTORY i ON i.product_id = spr.inventory_product_id
WHERE i.title = 'Classmate Notebook';

DELETE m FROM messages m
INNER JOIN conversations c ON c.conv_id = m.conv_id
INNER JOIN INVENTORY i ON i.product_id = c.product_id
WHERE i.title = 'Classmate Notebook';

DELETE cp FROM conversation_participants cp
INNER JOIN conversations c ON c.conv_id = cp.conv_id
INNER JOIN INVENTORY i ON i.product_id = c.product_id
WHERE i.title = 'Classmate Notebook';

DELETE c FROM conversations c
INNER JOIN INVENTORY i ON i.product_id = c.product_id
WHERE i.title = 'Classmate Notebook';

DELETE pr FROM product_reviews pr
INNER JOIN INVENTORY i ON i.product_id = pr.product_id
WHERE i.title = 'Classmate Notebook';

DELETE FROM INVENTORY
WHERE title = 'Classmate Notebook';

DELETE FROM purchase_history
WHERE user_id = @buyer_id;

SET FOREIGN_KEY_CHECKS = 1;

-- Seed (requires testuserA / testuserB from 008_testUserA-B.sql)
INSERT INTO INVENTORY (
  title,
  categories,
  item_location,
  item_condition,
  description,
  photos,
  listing_price,
  item_status,
  trades,
  price_nego,
  date_listed,
  seller_id,
  sold,
  final_price,
  date_sold,
  sold_to,
  wishlisted
) VALUES (
  'Classmate Notebook',
  JSON_ARRAY('Books'),
  'North Campus',
  'Like New',
  'This is a classmate notebook.',
  JSON_ARRAY('/images/marble-notebook.jpg'),
  3.00,
  'Sold',
  0,
  1,
  '2020-11-14',
  @seller_id,
  1,
  4.00,
  '2020-11-14',
  @buyer_id,
  0
);
SET @pid = LAST_INSERT_ID();

INSERT INTO conversations (
  user1_id,
  user2_id,
  product_id,
  user1_fname,
  user2_fname,
  user1_deleted,
  user2_deleted,
  created_at
) VALUES (
  @buyer_id,
  @seller_id,
  @pid,
  @buyer_display,
  @seller_display,
  0,
  0,
  '2020-11-15 00:15:01'
);
SET @conv_id = LAST_INSERT_ID();

INSERT INTO conversation_participants (conv_id, user_id, first_unread_msg_id, unread_count)
VALUES
  (@conv_id, @buyer_id, 0, 0),
  (@conv_id, @seller_id, 0, 0);

INSERT INTO scheduled_purchase_requests (
  inventory_product_id,
  seller_user_id,
  buyer_user_id,
  conversation_id,
  meet_location,
  meeting_at,
  verification_code,
  description,
  negotiated_price,
  is_trade,
  trade_item_description,
  snapshot_price_nego,
  snapshot_trades,
  snapshot_meet_location,
  status,
  canceled_by_user_id,
  buyer_response_at,
  created_at,
  updated_at
) VALUES (
  @pid,
  @seller_id,
  @buyer_id,
  @conv_id,
  'North Campus',
  '2020-11-17 18:00:00',
  'N57U',
  'Buyer wants this',
  3.00,
  0,
  NULL,
  1,
  0,
  'North Campus',
  'accepted',
  NULL,
  '2020-11-14 00:17:31',
  '2020-11-15 00:17:26',
  '2025-11-18 00:34:51'
);
SET @sched_id = LAST_INSERT_ID();

INSERT INTO confirm_purchase_requests (
  scheduled_request_id,
  inventory_product_id,
  seller_user_id,
  buyer_user_id,
  conversation_id,
  is_successful,
  final_price,
  seller_notes,
  failure_reason,
  failure_reason_notes,
  status,
  expires_at,
  buyer_response_at,
  auto_processed_at,
  payload_snapshot,
  created_at,
  updated_at
) VALUES (
  @sched_id,
  @pid,
  @seller_id,
  @buyer_id,
  @conv_id,
  1,
  4.00,
  'Price increased',
  NULL,
  NULL,
  'buyer_accepted',
  '2020-11-19 00:18:48',
  '2020-11-14 06:20:05',
  NULL,
  CONCAT(
    '{"buyer_id":', @buyer_id,
    ',"is_trade":false,"seller_id":', @seller_id,
    ',"item_title":"Classmate Notebook","meeting_at":"2020-11-17T18:00:00+00:00",',
    '"description":"Buyer wants this","meet_location":"North Campus",',
    '"negotiated_price":3,"trade_item_description":null}'
  ),
  '2020-11-14 06:20:05',
  '2025-11-18 00:34:07'
);
SET @confirm_id = LAST_INSERT_ID();

INSERT INTO messages (
  conv_id,
  sender_id,
  receiver_id,
  sender_fname,
  receiver_fname,
  content,
  image_url,
  metadata,
  created_at,
  edited_at
) VALUES
(
  @conv_id,
  @buyer_id,
  @seller_id,
  @buyer_display,
  @seller_display,
  CONCAT(@buyer_display, ' would like to message you about Classmate Notebook'),
  NULL,
  CAST(
    JSON_OBJECT(
      'type', 'listing_intro',
      'product', JSON_OBJECT(
        'product_id', @pid,
        'title', 'Classmate Notebook',
        'image_url', '/images/marble-notebook.jpg'
      ),
      'buyer_name', @buyer_display
    ) AS CHAR
  ),
  '2020-11-15 00:15:01',
  NULL
),
(
  @conv_id,
  @buyer_id,
  @seller_id,
  @buyer_display,
  @seller_display,
  'Hey I want this',
  NULL,
  NULL,
  '2020-11-15 00:15:05',
  NULL
),
(
  @conv_id,
  @seller_id,
  @buyer_id,
  @seller_display,
  @buyer_display,
  CONCAT(@seller_display, ' has scheduled a purchase. Please Accept or Deny.'),
  NULL,
  CONCAT(
    '{"type":"schedule_request","request_id":', @sched_id,
    ',"inventory_product_id":', @pid,
    ',"product_id":', @pid,
    ',"product_title":"Classmate Notebook","meeting_at":"2025-11-18T23:00:00+00:00",',
    '"meet_location":"North Campus","verification_code":"N57U","description":"Buyer wants this",',
    '"negotiated_price":2.99,"listing_price":3,"is_trade":false,"trade_item_description":null}'
  ),
  '2020-11-15 00:17:26',
  NULL
),
(
  @conv_id,
  @buyer_id,
  @seller_id,
  @buyer_display,
  @seller_display,
  CONCAT(@buyer_display, ' has accepted the scheduled purchase.'),
  NULL,
  CONCAT('{"type":"schedule_accepted","request_id":', @sched_id, '}'),
  '2020-11-15 00:17:31',
  NULL
),
(
  @conv_id,
  @seller_id,
  @buyer_id,
  @seller_display,
  @buyer_display,
  CONCAT(@seller_display, ' submitted a Confirm Purchase form for Classmate Notebook.'),
  NULL,
  CONCAT(
    '{"type":"confirm_request","confirm_request_id":', @confirm_id,
    ',"scheduled_request_id":', @sched_id,
    ',"inventory_product_id":', @pid,
    ',"product_title":"Classmate Notebook","buyer_user_id":', @buyer_id,
    ',"seller_user_id":', @seller_id,
    ',"is_successful":true,"final_price":4,"seller_notes":"","failure_reason":null,"failure_reason_notes":null,',
    '"meet_location":"North Campus","meeting_at":"2025-11-18T23:00:00+00:00",',
    '"expires_at":"2025-11-19T00:18:48+00:00","snapshot":{"item_title":"Classmate Notebook","buyer_id":',
    @buyer_id,
    ',"seller_id":', @seller_id,
    ',"meet_location":"North Campus","meeting_at":"2025-11-18T23:00:00+00:00",',
    '"description":"Buyer wants this","negotiated_price":2.99,"trade_item_description":null,"is_trade":false}}'
  ),
  '2020-11-15 00:18:48',
  NULL
),
(
  @conv_id,
  @buyer_id,
  @seller_id,
  @buyer_display,
  @seller_display,
  CONCAT(@buyer_display, ' accepted the Confirm Purchase form.'),
  NULL,
  CONCAT(
    '{"type":"confirm_accepted","confirm_request_id":', @confirm_id,
    ',"scheduled_request_id":', @sched_id,
    ',"inventory_product_id":', @pid,
    ',"is_successful":true,"final_price":4,"seller_notes":"","failure_reason":null,"failure_reason_notes":null,',
    '"snapshot":{"buyer_id":', @buyer_id,
    ',"is_trade":false,"seller_id":', @seller_id,
    ',"item_title":"Classmate Notebook","meeting_at":"2025-11-18T23:00:00+00:00",',
    '"description":"Buyer wants this","meet_location":"North Campus","negotiated_price":2.99,"trade_item_description":null},',
    '"responded_at":"2025-11-18T00:18:52+00:00"}'
  ),
  '2020-11-15 00:18:52',
  NULL
);

INSERT INTO product_reviews (
  product_id,
  buyer_user_id,
  seller_user_id,
  rating,
  product_rating,
  review_text,
  image1_url,
  image2_url,
  image3_url,
  created_at,
  updated_at
) VALUES (
  @pid,
  @buyer_id,
  @seller_id,
  4.0,
  4.0,
  'This was cool!',
  '/media/review-images/review_u30_20260415_162742_5d41e490a1c0.jpg',
  NULL,
  NULL,
  '2025-11-17 23:11:39',
  NULL
)
ON DUPLICATE KEY UPDATE
  seller_user_id = VALUES(seller_user_id),
  rating = VALUES(rating),
  product_rating = VALUES(product_rating),
  review_text = VALUES(review_text),
  image1_url = VALUES(image1_url),
  image2_url = VALUES(image2_url),
  image3_url = VALUES(image3_url),
  created_at = VALUES(created_at),
  updated_at = VALUES(updated_at);

INSERT INTO purchase_history (user_id, items, created_at, updated_at)
VALUES (
  @buyer_id,
  CONCAT(
    '[{"product_id":', @pid,
    ',"recorded_at":"2020-11-14T06:20:05+00:00","confirm_payload":{',
    '"final_price":4,"seller_notes":"","auto_accepted":false,"is_successful":true,',
    '"failure_reason":null,"confirm_request_id":', @confirm_id,
    ',"failure_reason_notes":null}}]'
  ),
  '2020-11-15 00:18:52',
  NULL
);

COMMIT;
