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
  'Used fabric storage bin for a dorm room, closet, or apartment. The outside has some light wear from being stored and moved, which is why I marked it fair, but the bin still holds its shape and works as it should. It has a roomy interior for folded clothes, towels, blankets, shoes, books, or the pile of things that never seems to find a home. The two handles make it easy to pull from a shelf or carry across the room. When you do not need it, the sides fold down so it can slide beside a dresser or under a bed. I used it for extra linens and winter clothes, and it kept my closet from turning into a heap. The neutral fabric is easy to place with other furniture, and the open top means you can see what is inside without digging through a box. There may be small marks on the fabric, but there are no major tears or broken handles. A practical choice for anyone who needs more storage without giving up floor space.',
  JSON_ARRAY('/images/storage-bin-product-image.jpg'),
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
  'Pack of suit hangers in like new condition. I bought them for a closet refresh and ended up using only a few, so most have spent their time hanging in the closet. They are sturdy enough for jackets, dress shirts, blazers, and heavier coats, with shaped shoulders that keep clothing from collapsing at the top. The lower bars are useful for pants and skirts, and the textured sections help keep smoother fabrics from sliding onto the floor. Their slim shape leaves more room between garments than bulky plastic hangers, which matters in a small dorm closet. They are clean, straight, and ready to use. I am selling the full pack together rather than separating them. They would be useful for someone moving into a first apartment, preparing for interviews, or simply trying to make a crowded closet easier to manage. There are no cracked pieces, bent arms, or loose parts. Bring a bag if you are picking them up because the pack is easier to carry together.',
  JSON_ARRAY('/images/suit-hangers-product-image.jpg'),
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
  'Small tabletop mirror in excellent condition. I kept it on my desk for getting ready in the morning, checking makeup, fixing my hair, and making sure I did not leave the room with a crooked collar. The base is steady, and the mirror tilts so you can find a comfortable angle instead of leaning over the desk. Its size works well on a nightstand, vanity, shelf, or a narrow bathroom counter without crowding everything around it. The glass gives a clear view and has no cracks or cloudy spots. It is light enough to move when you need the desk for studying, but it does not feel flimsy when you adjust it. I am selling it because I have started using a larger wall mirror. It has been kept indoors, away from moisture, and the frame has only minor signs of handling. The neutral frame looks fine with a simple room setup, and the mirror is small enough to pack safely when you move between semesters. A useful little mirror for a dorm room, shared apartment, or anyone who wants a quick view close to their desk.',
  JSON_ARRAY('/images/desk-mirror-product-image.webp'),
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
  'Bob Marley poster in like new condition. I bought it for a music themed wall and ended up changing the room before I had a chance to frame it, so it has spent most of its time stored flat. The image has warm colors, a clear portrait, and the kind of relaxed presence that makes a blank wall feel less bare without taking over the whole room. The paper is clean, with no tears, folds, water marks, or writing across the picture. It can be framed, hung with clips, or attached with removable strips if you are decorating a dorm and do not want to make holes. The poster is light enough to carry across campus and easy to roll for transport, although I would keep it flat once you get home. It would fit well above a desk, beside a record shelf, or in a bedroom with other music art. The darker colors should work with a room that already has wood, black, or warm neutral furniture, and the simple portrait leaves room for other decorations around it. I am letting it go because I no longer have space for the wall display I planned.',
  JSON_ARRAY('/images/bob-marley-poster-product-image.jpg'),
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
  'Used PlayStation 2 in fair condition. The console has the usual marks from years of use, but the body is intact and the disc door opens and closes normally. The photos show the console, controller, power cable, and video cable included with the listing, so please check them before arranging pickup. This is a good starter setup for someone who wants to revisit older games without paying collector prices for a perfect display piece. The PS2 library has racing games, sports titles, role playing games, action games, and plenty of couch multiplayer favorites. It also plays DVDs, which is handy if you want one small system for an older television. I would give the cables a quick test with your own setup before buying because television connections are different from one room to another. Expect cosmetic wear, not a pristine collector item. I am selling it because it has been sitting in a closet while newer systems get all the use. Bring a tote or backpack for the cables and console.',
  JSON_ARRAY('/images/playstation-2-product-image.jpg'),
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
  'Mini LED monitor in like new condition. I used it as a second screen for schoolwork and gaming, then packed it away when I changed my desk setup. The picture is bright and clear, and the screen is large enough to keep notes, a browser window, or a game visible without taking over a small desk. The included cables are shown in the photos. It accepts HDMI and USB C connections, so it can work with a laptop, desktop, game console, or another device that supports those outputs. Please check your own ports before buying, especially if your computer needs an adapter. The stand folds away for storage and gives you a comfortable viewing angle when it is open. The frame and screen are clean, with no cracks or dead areas that I have noticed. It is light enough to move between a dorm room and an apartment. A useful option for a student who wants more screen space but does not want a large permanent monitor taking up the whole desk. I am selling it because I no longer need the extra display.',
  JSON_ARRAY('/images/mini-led-monitor-product-image.jpg'),
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
  'Used frying pan in fair condition. I cooked with it throughout the semester, so the inside has visible signs of use and the outside is not spotless, but it is still a useful pan for a dorm kitchen. The base sits flat on the stove, the handle is secure, and the cooking surface releases food well when you use a little oil or butter. I used it for eggs, grilled cheese, vegetables, reheating leftovers, and quick dinners when I did not feel like washing a larger pot. It is a practical size for one or two people and easy to rinse in a small sink. The pan is not being sold as new or decorative, and there are marks from regular cooking, which is reflected in the price. There are no loose screws or cracks in the handle. Please look closely at the photos if appearance matters to you. It would suit a student moving into a first kitchen, someone who needs a spare pan, or a cook who wants an inexpensive option for daily meals without worrying about adding more cookware to a small cabinet.',
  JSON_ARRAY('/images/frying-pan-product-image.jpg'),
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
  'Desk lamp in excellent condition with a stable base, adjustable arm, and shade that turns so you can aim the light where you need it. I used it beside my bed for reading and at my desk during late study sessions, and it gave me enough light to see notes without lighting up the entire room. The controls are simple, the lamp does not take much space, and the base feels steady when the arm is moved. It fits on a desk, nightstand, side table, or a small shelf beside a chair. The finish is clean with only minor handling marks, and there are no cracks or loose joints. I am including the bulb shown with it. You can use a softer bulb for a warmer room or a brighter one for schoolwork, depending on what you prefer. This is a good choice for a dorm because it is easy to move when you need the desk clear and easy to store during a room change. I am selling it after rearranging my room and switching to a wall light, so it has plenty of use left.',
  JSON_ARRAY('/images/desk-lamp-product-image.jpg'),
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
  'Three bottle Lysol air sanitizer pack in excellent condition. I bought it for a move and ended up with more cleaning supplies than I could use, so I am passing this set along. The bottles are clean and the labels are easy to read, with one purple, one orange, and one blue bottle in the pack shown in the photo. This is handy for a dorm, apartment, or shared house where the kitchen and bathroom seem to need attention every day. The spray is useful for refreshing rooms and following the directions on the label when you want to treat the air after cooking, cleaning, or dealing with a stale smell. Keep the bottles away from children and pets, and use them only as directed on the packaging. The bottles take up less space than a large box of supplies and can be stored together under a sink or in a closet. Nothing is leaking, cracked, or missing from the set. A simple pickup for someone who wants household supplies without buying three separate bottles.',
  JSON_ARRAY('/images/lysol-pack-product-image.jpeg'),
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
  'Freedom on My Mind textbook in like new condition. The pages are clean, the cover has very little wear, and I did not write or highlight inside the book. It gives a broad history of African American life and the United States, with chapters that connect major events to the people, movements, and ideas behind them. The readings include primary sources, maps, photographs, and questions that make it useful for class discussion or independent study. I found the chapter organization easy to follow when I needed to review a period quickly before an exam, and the index made it less annoying to find a person or event later. Please compare the edition, authors, and ISBN with your course syllabus before buying because instructors sometimes assign a different version. This copy is a good fit for a student who wants a clean book without paying full bookstore price. I am selling it because I finished the class and no longer need it on my shelf. It has been stored indoors and is ready for another semester.',
  JSON_ARRAY('/images/african-american-history-textbook-product-image.jpg'),
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
  'Steam iron in excellent condition. I used it for dress shirts, pants, curtains, and the occasional shirt that stayed in the dryer too long. It heats quickly and the steam makes stubborn wrinkles easier to smooth without pressing the same spot forever. The soleplate moves evenly across fabric, the handle is comfortable, and the controls are clear enough to adjust while you are working. The spray function helps when a crease refuses to disappear, and the water tank is large enough for a normal laundry session without constant refills. I always emptied the tank after use and stored the iron upright, so there is no standing water inside and no damage to the cord that I can see. Please check the fabric label on your clothes and use the proper setting, especially for delicate materials. It would be useful in a dorm, apartment, or first home for someone who wants to look presentable without paying for a new appliance.',
  JSON_ARRAY('/images/steam-iron-product-image.webp'),
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
  'Swiffer sweeper in like new condition. I bought it for a dorm room, used it a few times, and then moved into a place with a vacuum, so it has been sitting in the closet. The handle is light, the cleaning head turns easily, and it reaches under a bed or desk without making you kneel on the floor. Dry pads are useful for dust, crumbs, hair, and the mystery grit that appears near the door, while wet pads help with marks that need more than a quick pass. The pad holder is easy to use and the narrow shape makes the whole thing simple to store beside a cabinet. It works well on the hard floors found in most dorms and apartments. The sweeper has been kept indoors and is clean, with no cracked handle or bent cleaning head. I am including the box shown in the photo, but please bring your own replacement pads if you want to clean immediately after pickup. This is a practical choice for someone who wants a quick floor cleanup without storing a bucket, mop, and large vacuum in a small room.',
  JSON_ARRAY('/images/swiffer-product-image.jpg'),
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
