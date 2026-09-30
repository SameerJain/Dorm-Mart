START TRANSACTION;
-- Seed: Task #278 ongoing purchases page listings.
-- Purpose: adds Gaming Chair and Christmas Ornament listings for scheduled purchase testing.
-- Depends on: testuserschedulered@buffalo.edu.

-- Capture seller user_id for linking records
SELECT user_id INTO @seller_id
FROM user_accounts
WHERE email = 'testuserschedulered@buffalo.edu'
LIMIT 1;

-- Delete existing listings if they exist (idempotent cleanup)
DELETE FROM INVENTORY
WHERE title IN ('Gaming Chair', 'Christmas Ornament');

-- Insert Gaming Chair listing
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
  'Gaming Chair',
  JSON_ARRAY('Gaming', 'Furniture', 'Office'),
  'North Campus',
  'Like New',
  '$180 or best offer.

Gaming chair with a tall back, adjustable armrests, a reclining backrest, and separate head and lower back cushions that clip on and off (both cushions are included). Height and recline still adjust smoothly with no sticking or grinding, and the wheels roll fine on carpet and hardwood with no wobble or squeak.

Try sitting in it before you decide, since a chair that feels great to me might not fit someone with a different build.

Selling because I switched desks and don''t have space for it anymore. It''s full sized, so bring a car or a friend to help carry it, and we''d need a pickup spot on campus with room to load it.',
  JSON_ARRAY('/images/gaming-chair-product-image.jpeg'),
  180.00,
  'Active',
  0,
  1,
  CURDATE(),
  @seller_id,
  0
);

-- Insert Christmas Ornament listing
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
  'Christmas Ornament',
  JSON_ARRAY('Decor'),
  'North Campus',
  'Like New',
  'Single Christmas ornament, no chips, cracks, or faded spots. Bought it during a holiday sale and never put up a tree that year, so it''s been wrapped in a box ever since. One ornament, not a set, and the photo shows the exact design you''d get. $12, and I''m not against a reasonable offer. Easy to meet on campus.',
  JSON_ARRAY(
    '/images/christmas-ornament-test-image.jpg',
    '/images/christmas-ornament-test-image-2.jpg'
  ),
  12.00,
  'Active',
  0,
  0,
  CURDATE(),
  @seller_id,
  0
);

COMMIT;






