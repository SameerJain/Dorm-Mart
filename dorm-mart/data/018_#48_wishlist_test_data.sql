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
  'Calculus: Early Transcendentals textbook. Match the edition and ISBN against your syllabus before buying, since professors sometimes assign a specific printing and the exercises can differ between editions even when the title looks identical.

Pages are clean with no writing, highlighting, or torn corners. The book covers differential and integral calculus with worked examples, diagrams, and practice problems throughout, and I found it genuinely useful for reviewing a concept before an exam rather than relying only on lecture notes.

This listing is for the physical book only, no online access code or homework platform login included. If your class requires digital access, you will need to purchase that separately regardless of which physical copy you buy.

Finished the class already, so I do not need it taking up space anymore. Reasonable offers are welcome on the $80 price, and I can meet up on campus to hand it off.',
  JSON_ARRAY('/images/calculus-early-transcdentals-product-image.jpg'),
  80.00,
  'Active',
  0,
  1,
  CURDATE(),
  @seller_id,
  0
);

COMMIT;






