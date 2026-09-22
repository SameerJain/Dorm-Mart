START TRANSACTION;
SET FOREIGN_KEY_CHECKS = 0;

-- Seed: Taco and Black Myth listings.
-- Purpose: adds two listings for the general test user from 001_general_test_user.sql.
-- Notes: migrate_data.php copies data/test-images assets into images/ before this runs.

SELECT user_id INTO @seller_id
FROM user_accounts
WHERE email = 'testuser@buffalo.edu'
LIMIT 1;

DELETE FROM INVENTORY
WHERE title IN ('Taco', 'Black Myth: Wukong (PS5)');

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
  'Taco',
  JSON_ARRAY('Kitchen', 'Food'),
  'North Campus',
  'Like New',
  'Fresh taco, made to order rather than sitting around waiting for a buyer. Ask about the specific fillings and toppings before ordering, since meat, beans, cheese, salsa, and vegetables can all vary and I do not want to assume what you are expecting to get.

Let me know about any allergies or dietary restrictions ahead of time so I can actually accommodate them properly instead of guessing at the last minute. This is food meant to be eaten fresh, so plan on picking it up and eating it right away rather than letting it sit around in a bag between classes.

$14.99, would consider a trade for another quick meal instead of cash. Can meet on campus at a time that works for both of us, ideally somewhere close to wherever it gets made so it does not sit around getting cold.',
  JSON_ARRAY('/images/taco-image.webp'),
  14.99,
  'Active',
  1,
  0,
  '2025-10-31',
  @seller_id,
  0,
  NULL,
  NULL,
  NULL,
  2
);

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
  'Black Myth: Wukong (PS5)',
  JSON_ARRAY('Games', 'Gaming', 'Digital'),
  'North Campus',
  'Excellent',
  'If you like learning a boss''s attack patterns and coming back for another attempt instead of brute forcing every fight, that is a big part of what you are getting here. Black Myth: Wukong for PS5, disc copy, tested and confirmed working with no read errors.

You play as the Destined One in a story drawing heavily on Journey to the West, using staff combat and magical transformations through encounters with creatures pulled from Chinese mythology. The combat genuinely rewards paying attention to what each enemy is doing rather than pressing through every fight the same way.

Confirm your PS5 has a disc drive before buying, since the digital only version obviously will not work with a physical disc. No DLC, bonus content, or extra codes included, just the base game as originally released.

$80, open to offers. Can meet on campus, and I am happy to answer questions about how far I got or what to expect from specific sections.',
  JSON_ARRAY('/images/black-myth-wukong-image.jpg'),
  80,
  'Active',
  0,
  1,
  '2025-11-02',
  @seller_id,
  0,
  NULL,
  NULL,
  NULL,
  0
);

SET FOREIGN_KEY_CHECKS = 1;
COMMIT;
