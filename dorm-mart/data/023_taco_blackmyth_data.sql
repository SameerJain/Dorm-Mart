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
  'fresh taco made to order, not sitting around waiting for a buyer. ask me about fillings and toppings before ordering since meat, beans, cheese, salsa and veggies can all vary and i don''t want to guess what you''re expecting. tell me about allergies or dietary stuff ahead of time too. it''s meant to be eaten right away so plan on picking it up and eating it, not letting it sit in a bag between classes. $14.99, would trade for another quick meal. we can meet on campus somewhere close to where it gets made so it doesn''t go cold',
  JSON_ARRAY(
    '/images/taco-image.webp',
    '/images/taco-image-2.jpg',
    '/images/taco-image-3.jpg'
  ),
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
  'If you like learning a boss''s attack patterns and coming back for another try instead of brute forcing every fight, that''s a big part of what you''re getting here. Black Myth: Wukong for PS5, disc copy, tested and working with no read errors.

You play as the Destined One in a story that draws heavily on Journey to the West, using staff combat and magical transformations against creatures from Chinese mythology. It rewards paying attention to what each enemy is doing.

Need a PS5 with a disc drive, the digital only console won''t read it. Base game only, no DLC or codes. $80, open to offers. Can meet on campus and I''m happy to tell you how far I got or what to expect from certain sections.',
  JSON_ARRAY(
    '/images/black-myth-wukong-image.jpg',
    '/images/black-myth-wukong-image-2.jpg',
    '/images/black-myth-wukong-image-3.jpg'
  ),
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
