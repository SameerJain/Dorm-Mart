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
  'Nightmoon wallpaper with the moon design shown clearly in the listing photo. I would measure your wall space before buying rather than assuming it will fit a specific spot, since I do not have exact dimensions listed beyond what is pictured.

No adhesive or mounting supplies included with this listing, just the wallpaper itself as pictured. If you rent your room or live in a dorm with rules about wall decorations, check whether this type of material is allowed before buying and applying it.

Lighting in your room will affect how the colors actually look once it is up, so use the photo as a general guide rather than an exact match to your screen. Application method depends on the material, so ask if you are unsure whether it needs paste or peels on directly.

$20, flexible on price, and I can meet on campus at whatever time works for you.',
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
