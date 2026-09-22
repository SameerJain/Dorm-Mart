START TRANSACTION;
-- Seed: Task #279 Electronic Drum Set listing.
-- Purpose: adds a distinct scheduled-purchase test item for Luke Skywalker.
-- Depends on: testuserschedulered@buffalo.edu.

-- Capture seller user_id for linking records
SELECT user_id INTO @seller_id
FROM user_accounts
WHERE email = 'testuserschedulered@buffalo.edu'
LIMIT 1;

-- Delete existing Electronic Drum Set listing if it exists (idempotent cleanup)
DELETE FROM INVENTORY
WHERE title = 'Electronic Drum Set';

-- Insert Electronic Drum Set listing
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
  'Electronic Drum Set',
  JSON_ARRAY('Electronics', 'Gaming'),
  'North Campus',
  'Like New',
  'No sticks, pedals, or a seat included, so plan on sourcing those separately if you do not already have them. Electronic drum set with mesh pads, cymbals, and a drum module on an adjustable rack, all of it still working correctly.

Mesh heads keep noise down compared to an acoustic kit, though hitting the pads and pedals still produces some sound and vibration, so keep that in mind if you have roommates. The module includes several drum kits along with a metronome and practice functions, which I used a lot when I was first learning.

USB and audio outputs are available for connecting to a computer or recording setup, but check the model against your own equipment first. Selling because I do not have room for it in my new place and it has mostly gone unused for months.

Flexible on the $250 price. Measure your practice space before buying, since even a compact electronic kit takes up more room than it looks like in photos.',
  JSON_ARRAY('/images/electronic-drum-set-product-image.jpeg'),
  250.00,
  'Active',
  0,
  1,
  CURDATE(),
  @seller_id,
  0
);

COMMIT;






