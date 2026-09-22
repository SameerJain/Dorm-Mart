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
  'Fabric storage bin that held my winter clothes and extra towels for a full semester without any rips or broken seams, so it clearly holds up to regular use. It folds flat when empty, which matters if you do not want a rigid box taking up floor space between semesters.

There is visible wear on the outside fabric from being moved around a lot, mostly light marks rather than anything major, which is why I priced it where I did. The two handles are both solid and work fine for pulling it off a shelf or carrying it across a room.

The open top means you can see what is inside without digging through it, though it will not keep dust out the way a lidded container would. Selling just the bin, nothing inside it.

$15.99, open to offers. Can meet on campus, though bring a bag or something to carry it in since it does not fold small enough to fit in a backpack.',
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
  'Pack of suit hangers with shaped shoulders that keep jackets and dress shirts from collapsing at the top, plus a lower bar for pants so a full outfit can hang together. No cracked pieces, bent arms, or loose joints anywhere in the set.

Bought more than I actually needed during a closet clean out at the start of the year, so most of these have just been hanging unused rather than holding anything. Selling the whole pack together rather than splitting it into smaller quantities.

These would be genuinely useful if you have interview clothes currently draped over a chair, or if you are about to move and want your shirts to survive the trip with fewer wrinkles. Bring a bag when you come to pick them up, since loose hangers have a way of catching on everything.

Open to trading for something else useful instead of cash. Can meet on campus.',
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
  'Tabletop mirror that tilts to whatever angle you need instead of forcing you to lean over the desk to see yourself properly. Glass is clear with no cracks or foggy patches, and the base stays steady even when you adjust the angle repeatedly throughout the day.

Switched to a wall mounted mirror recently, so this one no longer has a spot in my room. It has no built in light or magnification, just a plain mirror on a tilting base, so do not assume extra features that are not shown in the photos before buying.

Has been kept indoors away from moisture the whole time I owned it, and the frame only shows minor signs of handling. Small enough to fit on a nightstand, desk, or narrow counter without crowding anything else nearby.

$35, open to offers or a trade. Bring something soft to wrap it in if you are carrying it in a bag with books.',
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
  'Was originally going to build out a whole wall of music posters, bought this one, and then changed my mind about the room before ever framing it. It has mostly been stored flat since, which kept the paper in good shape.

Paper is clean with no tears, folds, water marks, or writing anywhere on the image. The portrait and warm color palette are what made me pick this one specifically, so check the photo closely if the exact tone matters for the room you are decorating.

This listing is for the poster only, no frame or hanging clips included, so you will need your own if you plan to display it right away. Rolling it for transport is fine, just keep it flat again once you get it home to avoid new creases.

Would consider trading for another piece of wall art instead of cash. Otherwise $24.99, and I can meet on campus.',
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
  'PS2 with the kind of visible wear you would expect from years of actual use, scuffs and scratches on the case, but the disc door still opens and closes normally and the console powers on every time without issues. Comes with the console itself, one controller, the power cable, and the video cable, all shown together in the photos.

Check your TV''s available inputs before buying, since a lot of newer televisions only have HDMI and you may need an adapter to connect an older console like this one. I have not tested every port repeatedly, so I would try it with your own setup as soon as possible after buying rather than assuming it will work.

No games are included with this listing, just the hardware. It is a reasonable starter setup if you want to revisit older games without paying collector prices for something in pristine display condition.

$50, open to offers. Bring a tote or backpack big enough for the console and all the loose cables so nothing ends up dragging on your way back.',
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
  'Selling because I switched to a single larger monitor setup and no longer need a second screen taking up desk space. Mini LED monitor with a bright, clear picture, no dead pixels or cracks anywhere on the screen that I have noticed.

Takes both HDMI and USB C connections, but check what your specific laptop or console actually outputs before buying, since having a matching port does not always mean a device supports video through it. The stand folds away for easier storage or transport, and the cables shown in the photos are included with the sale.

Frame and screen are both clean with no visible damage. It is a solid option if you want extra screen space for notes, a second window, or gaming without committing to a large permanent monitor on a small desk.

Flexible on the $80 price. Can meet on campus, and happy to plug it in and show that it powers on before you buy.',
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
  'Frying pan that got me through a full semester of eggs, grilled cheese, and reheated leftovers, so it is definitely a used pan rather than something display worthy. The cooking surface has visible marks from regular cooking, and the outside is not spotless, which is reflected in the price.

Base still sits completely flat on the stove, and the handle is secure with no cracks or loose screws anywhere. A little oil or butter helps food release cleanly, same as it did when I was using it regularly. It is a manageable size for cooking for one or two people rather than a full family meal.

This listing is just for the pan, no lid or utensils included. Check your stovetop compatibility before buying, since I have not tested it against every surface type.

Would trade for another kitchen item I could actually use instead of cash. Otherwise $20, and I can meet on campus.',
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
  'Desk lamp with an adjustable arm and a shade that rotates, so you can point the light exactly where you need it instead of lighting up the whole room. No cracks or loose joints anywhere, and the base stays steady even when the arm is fully extended.

I used this both beside my bed for reading and at my desk during late study sessions, and it gave off enough light to actually see notes clearly without keeping a roommate awake. The bulb currently in it is included, though you are welcome to swap in a different brightness or color temperature if you prefer.

Switched to a wall mounted light recently, so this one has just been sitting unused in the corner. Does not take up much desk space, though you should still leave room to adjust the arm without knocking into a monitor.

Open to a lower offer or a trade instead of the full $50 asking price. Can meet on campus.',
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
  'Three pack of Lysol air sanitizer spray, one purple, one orange, and one blue bottle, all shown together in the photo. Nothing is leaking or cracked, and the labels are still fully readable if you want to check the exact scents before deciding which one you would use first.

Ended up with more household cleaning supplies than I actually needed after a recent move, so I am passing this set along rather than letting it sit unused in a cabinet. I am selling all three bottles together as a set rather than splitting them up individually, so the price covers the whole pack.

Use according to the directions on the packaging, including any ventilation instructions, since I am not vouching for use beyond what the label recommends. $15 for all three, open to offers. Can meet on campus for a quick handoff.',
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
  'Finished this class already and do not need my copy of Freedom on My Mind anymore, so it has just been sitting on a shelf since the semester ended. Pages are clean with no writing or highlighting inside from me, and the cover shows very little wear.

The book covers African American history through a mix of readings, primary sources, maps, and photographs, and I found the index genuinely useful for finding a specific person or event quickly before an exam instead of flipping through chapters blindly.

Match the exact edition and ISBN against your syllabus before buying, since professors sometimes assign a different printing even when the title looks the same on the cover. This listing is for the physical book only, no online access code or digital platform login included.

Open to a trade or a lower price than the $30 listed, especially if you are also grabbing another book from my listings. Can meet on campus.',
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
  'Mostly used this for dress shirts and the occasional item I forgot in the dryer too long and needed to smooth out before class. Heats up quickly, no cord damage anywhere that I can see, and both the steam and spray functions still work exactly as they should.

The soleplate glides smoothly over fabric without catching, and the handle stays comfortable through a full ironing session. I always emptied the water tank after using it and stored it upright, so there should be no mineral buildup or standing water inside.

Controls are simple and easy to read, though you should still match the heat setting to whatever fabric label you are working with rather than guessing. This listing is for the iron itself, so you will need your own ironing board or a flat surface to work on.

Would consider a trade instead of cash. Otherwise $45, and I can meet up on campus.',
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
  'Swiffer sweeper, handle and cleaning head both work fine with no cracks or loose joints. Used it a handful of times in my dorm before moving somewhere with an actual vacuum, so it has mostly just been sitting in the closet since then.

The head turns easily to get around furniture legs and reach underneath a bed without needing to kneel on the floor. Works well on hard floors specifically, though you would still need something else entirely for carpet or a bigger mess than crumbs and dust.

Box shown in the photo is included with the listing, but no replacement pads, so bring your own if you want to use it right away after buying. Light enough to carry and narrow enough to store beside a cabinet.

Open to offers or a trade instead of the $15 asking price. Can meet on campus.',
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
