START TRANSACTION;
-- Seed: chat item-posting test listing.
-- Purpose: creates a single listing for chat item-posting tests.
-- Depends on: chatuser1@buffalo.edu from chat seed data.

SELECT user_id INTO @seller_id
FROM user_accounts
WHERE email = 'chatuser1@buffalo.edu'
LIMIT 1;

-- Delete existing listings if they exist (idempotent cleanup)
DELETE FROM INVENTORY
WHERE title IN ('Nightmoon Wallpaper');

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
  'Nightmoon Wallpaper',
  JSON_ARRAY('Decor'),
  'North Campus',
  'Like New',
  'Nightmoon wallpaper with the moon design shown in the listing photo.

Includes: just the wallpaper, no adhesive or mounting supplies
Size: no exact dimensions listed, so measure your wall before buying
Application: depends on the material, so ask if you''re not sure whether it needs paste or peels on
Housing: if you rent or live in a dorm, check whether this type of material is allowed

Colors will look a little different under your room lighting, so treat the photo as a guide. $20, flexible on price. Can meet on campus whenever works.',
  JSON_ARRAY('/images/nightmoon-wallpaper-image.jpg'),
  20.00,
  'Active',
  0,
  1,
  CURDATE(),
  @seller_id,
  0
);

COMMIT;
