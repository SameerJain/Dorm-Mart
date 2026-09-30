START TRANSACTION;
-- Seed: wishlist notification test users.
-- Purpose: creates receiver/seller accounts used by wishlist notification flows.
-- Safe to rerun: removes and recreates only these accounts.
SET FOREIGN_KEY_CHECKS = 0;

DELETE FROM user_accounts
WHERE email = 'wishlist-receiver@buffalo.edu';

DELETE FROM user_accounts
WHERE email = 'wishlist-sender@buffalo.edu';

INSERT INTO user_accounts (
  first_name,
  last_name,
  grad_month,
  grad_year,
  email,
  promotional,
  hash_pass,
  hash_auth,
  seller,
  theme
) VALUES (
  'test',
  'test',
  5,
  2027,
  'wishlist-receiver@buffalo.edu',
  0,
  '$2y$10$GbrdUE1/URrVdrSoa83d1OMfNWeJAuuzyEU4UvMMANKeub4./C.UO',
  NULL,
  0,
  0
);

INSERT INTO user_accounts (
  first_name,
  last_name,
  grad_month,
  grad_year,
  email,
  promotional,
  hash_pass,
  hash_auth,
  seller,
  theme
) VALUES (
  'test',
  'test',
  5,
  2027,
  'wishlist-sender@buffalo.edu',
  0,
  '$2y$10$GbrdUE1/URrVdrSoa83d1OMfNWeJAuuzyEU4UvMMANKeub4./C.UO',
  NULL,
  0,
  0
);

SET FOREIGN_KEY_CHECKS = 1;
COMMIT;


START TRANSACTION;

-- Capture seller user_id for linking records
SELECT user_id INTO @seller_id
FROM user_accounts
WHERE email = 'wishlist-receiver@buffalo.edu'
LIMIT 1;

-- Delete existing listings if they exist (idempotent cleanup)
DELETE FROM INVENTORY
WHERE title IN ('Starry Wallpaper', 'Sunset Wallpaper');

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
  'Starry Wallpaper',
  JSON_ARRAY('Decor'),
  'North Campus',
  'Like New',
  'Starry wallpaper, exact design and color arrangement shown in the listing photo. Barely used and it still has the original packaging, so check the material and application instructions there before buying since I haven''t tested it myself.

I haven''t listed exact dimensions, so ask if you need to know how much wall it covers, and try picturing it in the spot you have in mind, especially if there are shelves or furniture against that wall. Also check your housing rules before putting anything on a dorm wall. $20, open to offers, and I can meet on campus.',
  JSON_ARRAY('/images/starry-wallpaper-image.jpg'),
  20.00,
  'Active',
  0,
  1,
  CURDATE(),
  @seller_id,
  0
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
  sold
) VALUES (
  'Sunset Wallpaper',
  JSON_ARRAY('Decor'),
  'North Campus',
  'Like New',
  '$20 for this sunset print wallpaper, open to offers if that''s a stretch. Warm orange and pink palette, shown in the listing photo. Check it against your actual room lighting though, colors look pretty different under a warm bulb than in daylight. Unused and still in the original packaging, comes exactly as pictured with no hanging tools or extra adhesive beyond what''s on the material. No exact dimensions listed so ask if you need to know the coverage. Check your housing rules first if it''s going in a dorm. Easy to carry rolled up, can meet on campus.',
  JSON_ARRAY('/images/sunset-wallpaper-image.png'),
  20.00,
  'Active',
  0,
  1,
  CURDATE(),
  @seller_id,
  0
);

COMMIT;
