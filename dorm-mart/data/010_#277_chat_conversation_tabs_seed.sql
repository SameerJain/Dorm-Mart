-- Seed: Task #277 chat conversation tabs data.
-- Purpose: creates two products so the same users can have separate product conversations.
-- Depends on: 005_#276_chat_feature_seed.sql for the chat seed accounts.

START TRANSACTION;

-- Get user IDs for the test accounts (these should already exist from 005_#276)
SELECT user_id INTO @kylo_ren_id
FROM user_accounts
WHERE email = 'testuserchatfeaturesgreen@buffalo.edu'
LIMIT 1;

SELECT user_id INTO @po_dameron_id
FROM user_accounts
WHERE email = 'testuserchatfeaturesblue@buffalo.edu'
LIMIT 1;

-- Update Po Dameron to be a seller (needed for White and Blue Backpack listing)
UPDATE user_accounts
SET seller = 1
WHERE email = 'testuserchatfeaturesblue@buffalo.edu';

-- Delete existing products with these titles (idempotent cleanup)
DELETE FROM INVENTORY
WHERE title IN ('Blue Water Bottle', 'White and Blue Backpack');

-- Insert Blue Water Bottle (sold by Kylo Ren - testuserchatfeaturesgreen@buffalo.edu)
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
  'Blue Water Bottle',
  JSON_ARRAY('Health', 'Dorm Essentials'),
  'North Campus',
  'Like New',
  'Blue water bottle with no leaks, no cracks, and a cap that still seals tight. I only used it a handful of times before switching to a different one, so it mostly lived in a cabinet. I haven''t checked the exact capacity or how long it keeps drinks cold, so ask and I''ll measure it for you. Hand wash only as far as I know since it''s never been through a dishwasher. Just the bottle in the photo. $15, but I''ll take a reasonable offer, especially if you grab something else from my listings. Small enough to hand off between classes.',
  JSON_ARRAY(
    '/images/blue-water-bottle.jpg',
    '/images/blue-water-bottle-2.jpg',
    '/images/blue-water-bottle-3.jpg',
    '/images/blue-water-bottle-4.jpg'
  ),
  15.00,
  'Active',
  0,
  1,
  CURDATE(),
  @kylo_ren_id,
  0
);

-- Insert White and Blue Backpack (sold by Po Dameron - testuserchatfeaturesblue@buffalo.edu)
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
  'White and Blue Backpack',
  JSON_ARRAY('School', 'Dorm Essentials'),
  'North Campus',
  'Good',
  'White and blue backpack with a bunch of separate compartments, which was actually useful for keeping notebooks away from chargers and pens instead of everything sliding to the bottom of one big pocket. Good condition, meaning some visible wear on the lighter fabric from getting carried around campus, and the zippers all still glide smoothly with no broken pulls or stuck tracks.

Compare your laptop to the sleeve dimensions in the photos before you buy, I don''t want to promise a fit based on screen size alone. Bag only, nothing packed inside. Switched to a different style this semester. $25, open to offers, and I can meet somewhere on campus that works for you.',
  JSON_ARRAY(
    '/images/white-blue-backpack.jpg',
    '/images/white-blue-backpack-2.jpg',
    '/images/white-blue-backpack-3.jpg'
  ),
  25.00,
  'Active',
  0,
  1,
  CURDATE(),
  @po_dameron_id,
  0
);

COMMIT;
