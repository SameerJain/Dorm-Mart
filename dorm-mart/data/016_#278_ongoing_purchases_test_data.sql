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
  'Gaming chair with a tall back, adjustable armrests, a reclining backrest, and separate head and lower back cushions that clip on and off. Height and recline settings both still adjust smoothly, no sticking or grinding when you change position.

I would still recommend sitting in it before deciding, since a chair that feels great to me might feel completely different to someone with a different build. The base and wheels roll fine on both carpet and hardwood, no wobble or squeaking that I have noticed. The cushions shown in the photos are included.

Selling because I switched desks and no longer have room for a chair this size. It is full sized, so plan on a car or at least one other person to help carry it.

Open to reasonable offers on the $180 price. Can meet on campus, though we would probably need to coordinate a pickup spot with enough room to load it.',
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
  'Single Christmas ornament, no chips, cracks, or faded spots on the finish. I bought it during a holiday sale and never actually got around to putting up a tree that year, so it has just been sitting wrapped in a box since.

This is one ornament, not a set, and the listing photo shows exactly the design and color you would be getting rather than a generic stock image. It is light enough to hang without needing a particularly sturdy branch, so it would work on a small dorm tree, a wreath, or even hung somewhere on its own.

$12, and I am not really looking to negotiate much on something this inexpensive, though I am not totally against a reasonable offer either. Easy to meet up on campus whenever works for you, no need to plan far ahead for something this small and light to carry.',
  JSON_ARRAY('/images/christmas-ornament-test-image.jpg'),
  12.00,
  'Active',
  0,
  0,
  CURDATE(),
  @seller_id,
  0
);

COMMIT;






