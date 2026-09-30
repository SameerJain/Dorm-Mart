START TRANSACTION;
-- Seed: Task #275 scheduled purchase listings.
-- Purpose: adds Laundry Bag, House Plant, and Small Heater listings.
-- Notes: conversations are created through "Message Seller" in the UI, not here.

-- Capture seller user_id for linking records
SELECT user_id INTO @seller_id
FROM user_accounts
WHERE email = 'testuserschedulered@buffalo.edu'
LIMIT 1;

-- Delete existing listings if they exist (idempotent cleanup)
DELETE FROM INVENTORY
WHERE title IN ('Laundry Bag', 'House Plant', 'Small Heater');

-- Insert Laundry Bag listing
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
  sold
) VALUES (
  'Laundry Bag',
  JSON_ARRAY('Dorm Essentials', 'Utility'),
  'North Campus',
  'Like New',
  'Drawstring laundry bag with two carry handles for when it''s too full to grab by the string. The fabric held a full hamper''s worth of clothes all year without straining the seams. Barely used since I mostly did wash straight out of a hamper, and it folds flat when empty if you''re short on floor space. No shoulder strap, just the handles, and no detergent or supplies included. $12, and I''ll go lower if you''re picking up something else from my listings. Can meet on campus.',
  JSON_ARRAY('/images/laundry-bag-product-image.webp'),
  12.00,
  'Active',
  0,
  1,
  CURDATE(),
  @seller_id,
  0
);

-- Insert House Plant listing
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
  sold
) VALUES (
  'House Plant',
  JSON_ARRAY('Decor', 'Dorm Essentials'),
  'North Campus',
  'Like New',
  'House plant in the pot shown in the photos, healthy green leaves with no yellowing or dropped growth lately. Pot is included so you don''t have to find one right away. It''s been sitting near a window with decent indirect light and seems happy there.

Watering depends on the species and your light, so message me for care tips instead of assuming a generic schedule. If you have pets, look up whether this plant is safe for them before bringing it home. $15 firm since it''s already priced low for the size. Bring something to keep it upright if you''re walking.',
  JSON_ARRAY('/images/small-splant-product-image.jpg'),
  15.00,
  'Active',
  0,
  0,
  CURDATE(),
  @seller_id,
  0
);

-- Insert Small Heater listing
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
  sold
) VALUES (
  'Small Heater',
  JSON_ARRAY('Dorm Essentials', 'Utility'),
  'North Campus',
  'Like New',
  'Small ceramic heater with tip over shutoff and overheat protection. Those features don''t replace using it carefully though.

Warms a room up in a few minutes. Controls are just a dial, nothing complicated.

Keep it on a flat stable surface away from bedding and curtains, and check your building''s rules first because a lot of campus housing doesn''t allow space heaters at all. Heater only, no extension cord.

Selling since I won''t need it next year and don''t want it eating closet space over the summer. $35, flexible. Happy to plug it in and show it heats up before you buy. Can meet on campus.',
  JSON_ARRAY(
    '/images/small-heater-product-image.webp',
    '/images/small-heater-product-image-2.jpg'
  ),
  35.00,
  'Active',
  0,
  1,
  CURDATE(),
  @seller_id,
  0
);

COMMIT;






