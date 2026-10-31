START TRANSACTION;
-- Seed: realistic marketplace data.
-- Purpose: creates 4 organic-looking seller accounts and 12 diverse product listings.
-- Notes: each account has 3 unique items, with images copied from data/test-images.

-- Password hash for "1234!" for all accounts
SET @password_hash = '$2y$10$GbrdUE1/URrVdrSoa83d1OMfNWeJAuuzyEU4UvMMANKeub4./C.UO';

-- Re-running migrate_data.php leaves chat rows pointing at these users; allow cleanup without FK errors.
SET SESSION foreign_key_checks = 0;

-- ============================================
-- ACCOUNT 1: Lisa Patterson
-- ============================================
DELETE FROM user_accounts WHERE email = 'lisapatterson@buffalo.edu';

INSERT INTO user_accounts (
  first_name,
  last_name,
  grad_month,
  grad_year,
  email,
  promotional,
  hash_pass,
  hash_auth,
  seller,
  theme
) VALUES (
  'Lisa',
  'Patterson',
  5,
  2026,
  'lisapatterson@buffalo.edu',
  0,
  @password_hash,
  NULL,
  1,
  0
);

SET @lisa_id = LAST_INSERT_ID();

-- Item 1: Storage Bin For Room
DELETE FROM INVENTORY WHERE title = 'Storage Bin For Room' AND seller_id = @lisa_id;

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
  'Storage Bin For Room',
  JSON_ARRAY('Dorm Essentials', 'Utility'),
  'North Campus',
  'Fair',
  'Fabric storage bin that held my winter clothes and extra towels for a whole semester with no rips or broken seams. Folds flat when empty, handy if you don''t want a rigid box in the way between semesters. Some light wear and marks on the outside from being moved around, which is why it''s priced where it is. Both handles are solid, and the top is open so it won''t keep dust out like a lidded bin would. Bin only, nothing inside. $15.99, open to offers. Bring a bag to carry it since it doesn''t fold small enough for a backpack.',
  JSON_ARRAY(
    '/images/storage-bin-product-image.jpg',
    '/images/storage-bin-product-image-2.jpg',
    '/images/storage-bin-product-image-3.jpg'
  ),
  15.99,
  'Active',
  0,
  1,
  CURDATE(),
  @lisa_id,
  0
);

-- Item 2: Suit Hanger Pack
DELETE FROM INVENTORY WHERE title IN ('Suit Hangar Pack', 'Suit Hanger Pack') AND seller_id = @lisa_id;

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
  'Suit Hanger Pack',
  JSON_ARRAY('Dorm Essentials', 'Clothing'),
  'South Campus',
  'Like New',
  'Pack of suit hangers with shaped shoulders so jackets and dress shirts don''t collapse at the top, plus a lower bar for pants. No cracked pieces, bent arms, or loose joints in the set. I bought more than I needed during a closet clean out, so most of them have just been hanging there unused. Handy if your interview clothes are draped over a chair right now, or you''re moving soon and want your shirts to arrive with fewer wrinkles. Selling the whole pack together.

Open to a trade instead of cash. Can meet on campus, bring a bag since loose hangers catch on everything.',
  JSON_ARRAY(
    '/images/suit-hangers-product-image.jpg',
    '/images/suit-hangers-product-image-2.jpg',
    '/images/suit-hangers-product-image-3.jpg',
    '/images/suit-hangers-product-image-4.jpg'
  ),
  18.00,
  'Active',
  1,
  0,
  CURDATE(),
  @lisa_id,
  0
);

-- Item 3: Small Desk Mirror
DELETE FROM INVENTORY WHERE title = 'Small Desk Mirror' AND seller_id = @lisa_id;

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
  'Small Desk Mirror',
  JSON_ARRAY('Dorm Essentials', 'Bed', 'Utility'),
  'Ellicott',
  'Excellent',
  'Tabletop mirror that tilts to whatever angle you need so you''re not leaning over your desk. Glass is clear with no cracks or fog, and the base stays put when you adjust it. No built in light or magnification, just a plain mirror. Switched to a wall mirror so it doesn''t have a spot in my room anymore. $35, open to offers or a trade. Wrap it in something soft if it''s riding in a bag with books.',
  JSON_ARRAY(
    '/images/desk-mirror-product-image.webp',
    '/images/desk-mirror-product-image-2.jpg',
    '/images/desk-mirror-product-image-3.jpg',
    '/images/desk-mirror-product-image-4.jpg'
  ),
  35.00,
  'Active',
  1,
  1,
  CURDATE(),
  @lisa_id,
  0
);


-- ============================================
-- ACCOUNT 2: Sadiq Khan
-- ============================================
DELETE FROM user_accounts WHERE email = 'sadiqkhan@buffalo.edu';

INSERT INTO user_accounts (
  first_name,
  last_name,
  grad_month,
  grad_year,
  email,
  promotional,
  hash_pass,
  hash_auth,
  seller,
  theme
) VALUES (
  'Sadiq',
  'Khan',
  5,
  2026,
  'sadiqkhan@buffalo.edu',
  0,
  @password_hash,
  NULL,
  1,
  0
);

SET @sadiq_id = LAST_INSERT_ID();

-- Item 4: Bob Marley Poster
DELETE FROM INVENTORY WHERE title = 'Bob Marley Poster' AND seller_id = @sadiq_id;

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
  'Bob Marley Poster',
  JSON_ARRAY('Decor', 'Misc.'),
  'Other',
  'Like New',
  'Was going to build a whole wall of music posters, bought this one, then changed my mind about the room before I ever framed it. It''s been stored flat since, so the paper is in good shape: no tears, folds, water marks, or writing on the image.

The portrait and warm color palette are why I picked it, so look closely at the photo if the exact tone matters for your room.

Poster only, no frame or hanging clips. Rolling it for the walk home is fine, just flatten it again once you''re back to avoid new creases. $24.99, or I''d consider trading for another piece of wall art. Can meet on campus.',
  JSON_ARRAY(
    '/images/bob-marley-poster-product-image.jpg',
    '/images/bob-marley-poster-product-image-2.jpg',
    '/images/bob-marley-poster-product-image-3.jpg',
    '/images/bob-marley-poster-product-image-4.jpg'
  ),
  24.99,
  'Active',
  1,
  0,
  CURDATE(),
  @sadiq_id,
  0
);

-- Item 5: Playstation 2
DELETE FROM INVENTORY WHERE title = 'Playstation 2' AND seller_id = @sadiq_id;

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
  'Playstation 2',
  JSON_ARRAY('Gaming', 'Games'),
  'Other',
  'Fair',
  'PS2 with the scuffs and scratches you''d expect from years of actual use, but it powers on every time and the disc door opens and closes fine.

Includes:
- Console
- One controller
- Power cable
- Video cable
(all shown in the photos, no games)

Heads up that a lot of newer TVs are HDMI only, so you may need an adapter for a console this old. I haven''t tested every port repeatedly, so try it with your own setup soon after buying. Cheap way to revisit old games without paying collector prices. $50, open to offers. Bring a tote or backpack big enough for the cables.',
  JSON_ARRAY(
    '/images/playstation-2-product-image.jpg',
    '/images/playstation-2-product-image-2.jpg',
    '/images/playstation-2-product-image-3.jpg'
  ),
  50.00,
  'Active',
  0,
  1,
  CURDATE(),
  @sadiq_id,
  0
);

-- Item 6: Mini LED Monitor
DELETE FROM INVENTORY WHERE title = 'Mini LED Monitor' AND seller_id = @sadiq_id;

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
  'Mini LED Monitor',
  JSON_ARRAY('Electronics', 'Gaming', 'Games'),
  'South Campus',
  'Like New',
  'Selling because I moved to a single larger monitor and don''t need a second screen eating desk space. It''s a mini LED monitor with a bright, clear picture, and I haven''t noticed any dead pixels or cracks. Takes both HDMI and USB C, but check what your laptop or console actually outputs first since a matching port doesn''t always mean it supports video. The stand folds away for storage or carrying, the cables in the photos are included, and the frame and screen are both clean with no visible damage. Good pick for extra screen space for notes, a second window, or gaming without committing to a big permanent monitor on a small desk. Flexible on the $80. Can meet on campus and I''m happy to plug it in so you can see it power on before you buy.',
  JSON_ARRAY(
    '/images/mini-led-monitor-product-image.jpg',
    '/images/mini-led-monitor-product-image-2.jpg',
    '/images/mini-led-monitor-product-image-3.jpg',
    '/images/mini-led-monitor-product-image-4.jpg'
  ),
  80.00,
  'Active',
  0,
  1,
  CURDATE(),
  @sadiq_id,
  0
);


-- ============================================
-- ACCOUNT 3: Michelle Romano
-- ============================================
DELETE FROM user_accounts WHERE email = 'michelleromano@buffalo.edu';

INSERT INTO user_accounts (
  first_name,
  last_name,
  grad_month,
  grad_year,
  email,
  promotional,
  hash_pass,
  hash_auth,
  seller,
  theme
) VALUES (
  'Michelle',
  'Romano',
  5,
  2026,
  'michelleromano@buffalo.edu',
  0,
  @password_hash,
  NULL,
  1,
  0
);

SET @michelle_id = LAST_INSERT_ID();

-- Item 7: Frying Pan
DELETE FROM INVENTORY WHERE title = 'Frying Pan' AND seller_id = @michelle_id;

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
  'Frying Pan',
  JSON_ARRAY('Kitchen', 'Food'),
  'Ellicott',
  'Fair',
  'Frying pan that got me through a semester of eggs, grilled cheese, and reheated leftovers, so it''s definitely used, not display worthy. Cooking surface has marks and the outside isn''t spotless, which is reflected in the price. Base sits flat, handle''s secure with no cracks or loose screws, and a little oil or butter helps stuff release. Good size for one or two people. No lid or utensils, and I haven''t tried it on every stovetop type so check yours. $20 or I''d trade for a kitchen item I''d actually use. Can meet on campus.',
  JSON_ARRAY(
    '/images/frying-pan-product-image.jpg',
    '/images/frying-pan-product-image-2.jpg',
    '/images/frying-pan-product-image-3.jpg'
  ),
  20.00,
  'Active',
  1,
  0,
  CURDATE(),
  @michelle_id,
  0
);

-- Item 8: Desk Lamp
DELETE FROM INVENTORY WHERE title = 'Desk Lamp' AND seller_id = @michelle_id;

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
  'Desk Lamp',
  JSON_ARRAY('Misc.', 'Utility'),
  'Other',
  'Excellent',
  'Desk lamp with an adjustable arm and a rotating shade, so you can aim the light where you need it instead of lighting the whole room. I used it next to my bed for reading and at my desk for late study sessions, and it was bright enough to see notes clearly without keeping my roommate awake. No cracks or loose joints and the base stays steady with the arm fully extended. The bulb in it is included but you can swap in a different brightness or color temperature. Switched to a wall mounted light so it''s just been sitting in a corner. Leave room to adjust the arm so you don''t knock into a monitor.

Open to a lower offer or a trade instead of the full $50. Can meet on campus.',
  JSON_ARRAY(
    '/images/desk-lamp-product-image.jpg',
    '/images/desk-lamp-product-image-2.jpg',
    '/images/desk-lamp-product-image-3.jpg',
    '/images/desk-lamp-product-image-4.jpg'
  ),
  50.00,
  'Active',
  1,
  1,
  CURDATE(),
  @michelle_id,
  0
);

-- Item 9: Lysol Air Freshener Pack
DELETE FROM INVENTORY WHERE title IN ('Lysol Air Freshner Pack', 'Lysol Air Freshener Pack') AND seller_id = @michelle_id;

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
  'Lysol Air Freshener Pack',
  JSON_ARRAY('Utility', 'Dorm Essentials'),
  'North Campus',
  'Excellent',
  'Three pack of Lysol air sanitizer spray:
purple, orange, and blue, all shown in the photo.
Nothing leaking or cracked and the labels are readable so you can check scents.
Got way more cleaning supplies than I needed after moving so I''m passing them on. Selling all three together, not split up.
Use per the directions on the packaging, including ventilation.
$15 for all three, open to offers. Can meet on campus.',
  JSON_ARRAY(
    '/images/lysol-pack-product-image.jpeg',
    '/images/lysol-pack-product-image-3.jpg',
    '/images/lysol-pack-product-image-4.jpg',
    '/images/lysol-pack-product-image-5.jpg'
  ),
  15.00,
  'Active',
  0,
  1,
  CURDATE(),
  @michelle_id,
  0
);

-- ============================================
-- ACCOUNT 4: Shawn Brockmeyer
-- ============================================
DELETE FROM user_accounts WHERE email = 'shawnbrockmeyer@buffalo.edu';

INSERT INTO user_accounts (
  first_name,
  last_name,
  grad_month,
  grad_year,
  email,
  promotional,
  hash_pass,
  hash_auth,
  seller,
  theme
) VALUES (
  'Shawn',
  'Brockmeyer',
  5,
  2026,
  'shawnbrockmeyer@buffalo.edu',
  0,
  @password_hash,
  NULL,
  1,
  0
);

SET @shawn_id = LAST_INSERT_ID();

-- Item 10 (for Shawn): African American History Textbook
DELETE FROM INVENTORY WHERE title = 'African American History Textbook' AND seller_id = @shawn_id;

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
  'African American History Textbook',
  JSON_ARRAY('School'),
  'North Campus',
  'Like New',
  'Finished this class, so my copy of Freedom on My Mind has been sitting on a shelf since the semester ended. Pages are clean with no writing or highlighting from me and the cover has very little wear. The book mixes readings, primary sources, maps, and photographs, and the index was really useful for finding a specific person or event before an exam.

Match the exact edition and ISBN to your syllabus first, professors sometimes assign a different printing. Physical book only, no access code or online login. $30, but I''m open to a trade or a lower price, especially if you''re also grabbing another book from my listings. Can meet on campus.',
  JSON_ARRAY(
    '/images/african-american-history-textbook-product-image.jpg',
    '/images/african-american-history-textbook-product-image-2.jpg',
    '/images/african-american-history-textbook-product-image-3.jpg'
  ),
  30.00,
  'Active',
  1,
  1,
  CURDATE(),
  @shawn_id,
  0
);

-- Item 11 (for Shawn): Steam Iron
DELETE FROM INVENTORY WHERE title = 'Steam Iron' AND seller_id = @shawn_id;

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
  'Steam Iron',
  JSON_ARRAY('Clothing', 'Electronics'),
  'South Campus',
  'Excellent',
  'Steam iron, mostly used for dress shirts and the occasional thing I left in the dryer too long.

Works: heats up quickly, steam and spray both work, no cord damage
Soleplate: glides smoothly without catching
Storage: always emptied the tank and stored it upright, so no mineral buildup that I know of
Not included: ironing board

Match the heat setting to the fabric label instead of guessing. $45, or I''d consider a trade. Can meet up on campus.',
  JSON_ARRAY(
    '/images/steam-iron-product-image.webp',
    '/images/steam-iron-product-image-2.jpg',
    '/images/steam-iron-product-image-3.jpg'
  ),
  45.00,
  'Active',
  1,
  0,
  CURDATE(),
  @shawn_id,
  0
);

-- Item 12 (for Shawn): Swiffer
DELETE FROM INVENTORY WHERE title = 'Swiffer' AND seller_id = @shawn_id;

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
  'Swiffer',
  JSON_ARRAY('Dorm Essentials', 'Misc.'),
  'North Campus',
  'Like New',
  'Swiffer sweeper, handle and head both work fine with no cracks or loose joints. Used it a handful of times in my dorm before moving somewhere with a real vacuum. Hard floors only, and the box is included but no replacement pads. $15 or a trade, can meet on campus.',
  JSON_ARRAY(
    '/images/swiffer-product-image.jpg',
    '/images/swiffer-product-image-2.jpg',
    '/images/swiffer-product-image-3.jpg'
  ),
  15.00,
  'Active',
  1,
  1,
  CURDATE(),
  @shawn_id,
  0
);

SET SESSION foreign_key_checks = 1;
COMMIT;
