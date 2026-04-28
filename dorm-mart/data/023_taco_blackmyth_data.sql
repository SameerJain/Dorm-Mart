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
  'A taco is a traditional Mexican dish that combines simplicity with bold, layered flavors. It begins with a soft or crispy tortilla, typically made from corn or flour, serving as the perfect vessel for a variety of fillings — from seasoned meats like beef, chicken, or pork, to fresh vegetables, beans, and melted cheese. Topped with salsa, guacamole, cilantro, onions, and a squeeze of lime, each bite delivers a perfect balance of spice, texture, and freshness. Versatile and handheld, tacos are enjoyed everywhere from street vendors to gourmet restaurants, embodying the vibrant, communal spirit of Mexican cuisine in every mouthful.',
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
  '"Black Myth: Wukong" for PlayStation 5 is an action RPG inspired by the legendary Chinese novel Journey to the West. Players step into the role of the Destined One, a warrior with powers reminiscent of the Monkey King, as they battle through a dark and mythic world filled with ancient gods, demons, and mystical creatures. Powered by Unreal Engine 5, the game delivers breathtaking visuals, fluid combat, and cinematic storytelling. With its mix of fast-paced staff combat, magical abilities, and immersive lore, Black Myth: Wukong on PS5 offers a next-generation journey through Chinese mythology that''s both visually stunning and deeply challenging.',
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
