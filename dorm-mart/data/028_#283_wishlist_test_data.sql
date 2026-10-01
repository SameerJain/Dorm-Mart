START TRANSACTION;
-- Seed: Task #283 wishlist listings.
-- Purpose: adds Britta Filter Box and TECKNET Red Mouse listings for wishlist testing.
-- Depends on: testuserschedulered@buffalo.edu.

-- Capture seller user_id for linking records
SELECT user_id INTO @seller_id
FROM user_accounts
WHERE email = 'testuserschedulered@buffalo.edu'
LIMIT 1;

-- Delete existing listings if they exist (idempotent cleanup)
DELETE FROM INVENTORY
WHERE title IN ('Britta Filter Box', 'TECKNET Red Mouse');

-- Insert Britta Filter Box listing
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
  'Britta Filter Box',
  JSON_ARRAY('Dorm Essentials', 'Kitchen'),
  'North Campus',
  'Like New',
  'Box of Brita replacement filters, unopened and still sealed. Brita makes a few different designs so check the filter type against your pitcher before buying, since the brand name alone doesn''t guarantee a fit. Filters only, no pitcher, and I haven''t opened it so I can''t confirm the count beyond what''s printed on the box. $25, open to offers. Small enough for a backpack so a quick handoff on campus works.',
  JSON_ARRAY(
    '/images/britta-filter-product-image.jpg',
    '/images/britta-filter-product-image-2.jpg',
    '/images/britta-filter-product-image-3.jpg',
    '/images/britta-filter-product-image-4.jpg'
  ),
  25.00,
  'Active',
  0,
  1,
  CURDATE(),
  @seller_id,
  0
);

-- Insert TECKNET Red Mouse listing
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
  'TECKNET Red Mouse',
  JSON_ARRAY('Electronics', 'Office'),
  'North Campus',
  'Like New',
  'TECKNET wired mouse in red, no connection issues or lag that I''ve noticed. Contoured grip, and the buttons and scroll wheel all respond like they should.

Check the model and connection type in the photos to make sure it works with your computer''s ports. It''s a pretty standard mouse, so don''t assume gaming features or adjustable sensitivity without confirming. Mouse only, no keyboard or other desk stuff. $15 and I''m not really negotiating, but ask if you want to see it working first. Can meet on campus.',
  JSON_ARRAY(
    '/images/teknet-mouse-product-image.webp',
    '/images/teknet-mouse-product-image-2.jpg',
    '/images/teknet-mouse-product-image-3.jpg',
    '/images/teknet-mouse-product-image-4.jpg'
  ),
  15.00,
  'Active',
  0,
  0,
  CURDATE(),
  @seller_id,
  0
);

COMMIT;






