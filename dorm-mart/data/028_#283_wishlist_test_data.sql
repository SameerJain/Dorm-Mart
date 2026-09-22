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
  'Box of Brita replacement filters, unopened and still sealed in the original packaging. Double check the specific filter type against your pitcher before buying, since Brita makes a few different designs and the brand name alone does not guarantee a fit.

Compatible with a range of Brita pitchers and dispensers, but I would rather you confirm compatibility directly than get home and find out it does not snap in properly. This listing is for the filter box itself, not a pitcher or dispenser, and I have not opened it to check the exact count inside beyond what is printed on the box.

$25 for the box, open to offers if the price feels high for what it is. Can meet on campus for a quick handoff since it is small enough to carry easily in a backpack, no need to plan around a bigger pickup.',
  JSON_ARRAY('/images/britta-filter-product-image.jpg'),
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
  'TECKNET wired mouse in red, works fine with no connection issues or lag that I have noticed. Comfortable, contoured grip shape for everyday use, and both the buttons and scroll wheel respond exactly as they should.

Check the exact model and connection type in the photos before buying so you know it will actually work with the ports on your specific computer. I would not assume any special gaming features or an adjustable sensitivity range without confirming the model first, since it is a fairly standard mouse rather than anything marketed for competitive gaming.

This listing is for the mouse only, no keyboard or other desk accessories included beyond what is shown. $15, and I am not really looking to negotiate on something this inexpensive, but ask if you want to see it working in person first. Can meet on campus.',
  JSON_ARRAY('/images/teknet-mouse-product-image.webp'),
  15.00,
  'Active',
  0,
  0,
  CURDATE(),
  @seller_id,
  0
);

COMMIT;






