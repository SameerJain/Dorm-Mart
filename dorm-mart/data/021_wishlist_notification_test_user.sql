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
  'Starry wallpaper, exact design and color arrangement shown in the listing photo. Barely used and still has the original packaging, so you can check the material and application instructions directly from that before buying anything, since I have not tested it myself.

I would try picturing it in the specific spot you want to decorate before committing, especially if that wall already has shelves, posters, or furniture against it. Ask about the dimensions if you need to know exactly how much wall space it will cover, since I have not listed exact measurements here in the description.

Check your housing rules before applying anything to a dorm wall, since some buildings restrict what can go up permanently. $20, open to offers, and I can meet on campus at a time that works for you.',
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
  '$20 for this sunset print wallpaper, open to offers if the price is a stretch. Warm orange and pink color palette, shown clearly in the listing photo, so check it against your actual room lighting before deciding, since colors can look pretty different under a warm bulb versus daylight.

Comes exactly as pictured, no hanging tools or extra adhesive included beyond whatever is already on the material itself. I have not listed exact dimensions, so ask directly if you need to know how much wall space it covers before committing to buy it. This is unused and still in its original packaging.

Worth checking your housing rules first if you are putting this up in a dorm, since some buildings have restrictions on wall coverings. Can meet on campus to hand it off, easy to carry rolled up.',
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
