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
  'No sticks, pedals, or seat included, so you''ll need to source those if you don''t already have them.

Electronic drum set with mesh pads, cymbals, and a drum module on an adjustable rack, all working correctly. The module has several drum kits plus a metronome and practice functions, which I used a lot when I was first learning.

Mesh heads are quieter than an acoustic kit, but hitting the pads and pedals still makes some noise and vibration, so keep roommates in mind. USB and audio outputs are there for connecting to a computer or recording, but check the model against your own gear first.

Selling because I don''t have room in my new place and it''s mostly gone unused for months. Measure your space first, even a compact kit takes up more room than it looks like in photos. $250, flexible.',
  JSON_ARRAY(
    '/images/electronic-drum-set-product-image.jpeg',
    '/images/electronic-drum-set-product-image-2.jpg',
    '/images/electronic-drum-set-product-image-3.jpg',
    '/images/electronic-drum-set-product-image-4.jpg'
  ),
  250.00,
  'Active',
  0,
  1,
  CURDATE(),
  @seller_id,
  0
);

COMMIT;






