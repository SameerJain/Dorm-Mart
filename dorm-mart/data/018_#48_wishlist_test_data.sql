START TRANSACTION;
-- Seed: Story #48 wishlist test listing.
-- Purpose: adds a Calculus textbook listing for wishlist add/remove testing.
-- Depends on: testuserschedulered@buffalo.edu.

-- Capture seller user_id for linking records
SELECT user_id INTO @seller_id
FROM user_accounts
WHERE email = 'testuserschedulered@buffalo.edu'
LIMIT 1;

-- Delete existing listing if it exists (idempotent cleanup)
DELETE FROM INVENTORY
WHERE title = 'Calculus: Early Transcendentals';

-- Insert Calculus: Early Transcendentals listing
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
  'Calculus: Early Transcendentals',
  JSON_ARRAY('Books', 'School'),
  'North Campus',
  'Like New',
  'Calculus: Early Transcendentals, finished the class so I don''t need it taking up shelf space. Pages are clean, no writing, highlighting, or torn corners. It covers differential and integral calculus with worked examples, diagrams, and practice problems, and I found it more helpful than lecture notes when reviewing before an exam.

Before you buy:
- Match the edition and ISBN to your syllabus. Exercises can differ between editions even when the title looks identical
- Physical book only, no online access code or homework platform login
- If your class needs digital access you''ll have to buy that separately

$80, reasonable offers welcome. Can meet on campus.',
  JSON_ARRAY(
    '/images/calculus-early-transcdentals-product-image.jpg',
    '/images/calculus-early-transcdentals-product-image-2.jpg',
    '/images/calculus-early-transcdentals-product-image-3.jpg'
  ),
  80.00,
  'Active',
  0,
  1,
  CURDATE(),
  @seller_id,
  0
);

COMMIT;






