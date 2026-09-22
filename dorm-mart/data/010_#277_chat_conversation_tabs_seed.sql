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
  'Blue water bottle, no leaks, no cracks, and the cap still seals tightly. I used it a handful of times before switching to a different bottle, so it has spent most of its life sitting in a cabinet rather than actually being used daily.

I am not claiming a specific capacity or insulation time, so if either of those matters for your routine, ask before buying and I will measure it for you. I have not run it through a dishwasher, so I can only vouch for hand washing, not how it holds up on a heat cycle. The bottle in the photo is exactly the one being sold, nothing else included.

Price is $15 but I am open to a reasonable offer, especially if you are also grabbing something else from my listings. Easy to meet up on campus since it is small enough to hand off between classes without scheduling anything in advance.',
  JSON_ARRAY('/images/blue-water-bottle.jpg'),
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
  'White and blue backpack with several separate compartments, which was genuinely useful for keeping notebooks apart from chargers and pens instead of everything sliding around together at the bottom of one big pocket. It is in good condition, meaning there is some visible wear on the lighter fabric from actually being carried around campus, not just sitting in a closet unused.

Zippers all still work smoothly, no broken pulls or stuck tracks anywhere on the bag. I would compare your laptop against the sleeve dimensions in the photos before buying, since I do not want to promise a fit based on screen size alone without you checking first. This is the bag by itself, nothing packed inside it.

Selling because I switched to a different bag style for this semester. $25, open to offers, and happy to meet somewhere on campus at a time that works for you.',
  JSON_ARRAY('/images/white-blue-backpack.jpg'),
  25.00,
  'Active',
  0,
  1,
  CURDATE(),
  @po_dameron_id,
  0
);

COMMIT;
