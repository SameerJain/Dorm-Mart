START TRANSACTION;
-- Seed: Task #274 scheduled purchase test data.
-- Purpose: creates Luke Skywalker (seller), Han Solo (buyer), and three listings.
-- Notes: conversations are created through "Message Seller" in the UI, not here.

-- First, get the user IDs if they exist (for cleanup)
SELECT user_id INTO @existing_seller_id
FROM user_accounts
WHERE email = 'testuserschedulered@buffalo.edu'
LIMIT 1;

SELECT user_id INTO @existing_buyer_id
FROM user_accounts
WHERE email = 'testuserscheduleyellow@buffalo.edu'
LIMIT 1;

-- Delete related records in dependency order before deleting user accounts
-- Must delete in order: messages -> scheduled_purchases -> conversations -> users
-- Handle NULL user IDs gracefully - only delete if users exist

-- 1. Delete messages where these users are sender or receiver (must be first due to FK constraints)
DELETE FROM messages
WHERE (@existing_seller_id IS NOT NULL AND (sender_id = @existing_seller_id OR receiver_id = @existing_seller_id))
   OR (@existing_buyer_id IS NOT NULL AND (sender_id = @existing_buyer_id OR receiver_id = @existing_buyer_id));

-- 2. Delete scheduled purchase requests
DELETE FROM scheduled_purchase_requests
WHERE (@existing_seller_id IS NOT NULL AND (buyer_user_id = @existing_seller_id OR seller_user_id = @existing_seller_id))
   OR (@existing_buyer_id IS NOT NULL AND (buyer_user_id = @existing_buyer_id OR seller_user_id = @existing_buyer_id));

-- Note: Conversations are NOT deleted here - they should be created naturally via "Message Seller" button in UI
-- 3. Delete conversations where these users participate (this cascades to conversation_participants)
DELETE FROM conversations
WHERE (@existing_seller_id IS NOT NULL AND (user1_id = @existing_seller_id OR user2_id = @existing_seller_id))
   OR (@existing_buyer_id IS NOT NULL AND (user1_id = @existing_buyer_id OR user2_id = @existing_buyer_id));

-- 4. Delete conversation_participants (in case cascade didn't work)
DELETE FROM conversation_participants
WHERE (@existing_seller_id IS NOT NULL AND user_id = @existing_seller_id)
   OR (@existing_buyer_id IS NOT NULL AND user_id = @existing_buyer_id);

-- 5. Delete purchased items
DELETE FROM purchased_items
WHERE (@existing_seller_id IS NOT NULL AND (buyer_user_id = @existing_seller_id OR seller_user_id = @existing_seller_id))
   OR (@existing_buyer_id IS NOT NULL AND (buyer_user_id = @existing_buyer_id OR seller_user_id = @existing_buyer_id));

-- 6. Delete inventory items owned by seller
DELETE FROM INVENTORY
WHERE @existing_seller_id IS NOT NULL AND seller_id = @existing_seller_id;

-- Now safe to delete user accounts
DELETE FROM user_accounts
WHERE email IN (
  'testuserschedulered@buffalo.edu',
  'testuserscheduleyellow@buffalo.edu'
);

-- Seller account (Luke Skywalker) – able to create listings
INSERT INTO user_accounts (
  first_name,
  last_name,
  grad_month,
  grad_year,
  email,
  promotional,
  hash_pass,
  hash_auth,
  join_date,
  seller,
  theme,
  reset_token_expires,
  last_reset_request,
  received_intro_promo_email,
  reveal_contact_info,
  interested_category_1,
  interested_category_2,
  interested_category_3
) VALUES (
  'Luke',
  'Skywalker',
  5,
  2027,
  'testuserschedulered@buffalo.edu',
  0,
  '$2y$10$kXWN5BJO0ZG8Rynf7FEzPekQ5fiwXMiFttJpDjvrnncuym0DHHxRq', -- password: 1234!
  NULL,
  CURDATE(),
  1,
  0,
  NULL,
  NULL,
  0,
  0,
  NULL,
  NULL,
  NULL
);

-- Buyer account (Han Solo) – standard user
INSERT INTO user_accounts (
  first_name,
  last_name,
  grad_month,
  grad_year,
  email,
  promotional,
  hash_pass,
  hash_auth,
  join_date,
  seller,
  theme,
  reset_token_expires,
  last_reset_request,
  received_intro_promo_email,
  reveal_contact_info,
  interested_category_1,
  interested_category_2,
  interested_category_3
) VALUES (
  'Han',
  'Solo',
  5,
  2027,
  'testuserscheduleyellow@buffalo.edu',
  0,
  '$2y$10$kXWN5BJO0ZG8Rynf7FEzPekQ5fiwXMiFttJpDjvrnncuym0DHHxRq', -- password: 1234!
  NULL,
  CURDATE(),
  0,
  0,
  NULL,
  NULL,
  0,
  0,
  NULL,
  NULL,
  NULL
);

-- Capture user ids for linking records
SELECT user_id INTO @seller_id
FROM user_accounts
WHERE email = 'testuserschedulered@buffalo.edu'
LIMIT 1;

SELECT user_id INTO @buyer_id
FROM user_accounts
WHERE email = 'testuserscheduleyellow@buffalo.edu'
LIMIT 1;

-- Delete existing listings tied to this scenario (idempotent cleanup)
DELETE FROM INVENTORY
WHERE title IN ('Scrub Daddy', 'Air Fryer', 'Pim Plushie');

-- Insert Scrub Daddy listing
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
  'Scrub Daddy',
  JSON_ARRAY('Kitchen', 'Utility'),
  'North Campus',
  'Like New',
  'Scrub Daddy sponge, barely used since I bought a pack and only needed one at a time. The texture changes with water temperature: cold water firms it up for scrubbing baked on messes, and warm water softens it for everyday dishes.

This listing is just for the sponge shown in the photo, no cleaning spray or other supplies included. It works on most kitchen surfaces, though I would check care instructions before using it on anything with a delicate finish like nonstick coating. Small enough to keep by a shared sink without adding clutter to a crowded counter, and it rinses clean without holding onto smells the way some sponges do.

Price is firm at $10. Happy to meet up on campus for a quick handoff, no need to schedule anything elaborate for something this small and easy to carry.',
  JSON_ARRAY('/images/scrub-daddy.jpg'),
  10.00,
  'Active',
  0,
  0,
  CURDATE(),
  @seller_id,
  0
);

-- Insert Air Fryer listing (price negotiable)
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
  'Air Fryer',
  JSON_ARRAY('Kitchen', 'Utility'),
  'North Campus',
  'Good',
  'This air fryer got a lot of use for quick meals between classes, mostly fries, chicken, and reheating food I did not feel like microwaving. It still heats up fast and works exactly the way it should, no weird noises or slow starts.

There are a few marks and some scuffing on the outside from regular use, which is why I am not calling it like new, but nothing about that affects performance. The basket and tray are both included, along with the base unit. No extra racks or attachments beyond what came in the box originally.

The compact size was useful when I did not have much counter space, though it also means you are cooking smaller batches rather than a full family meal at once. If you usually cook for several people, keep that in mind before buying. Selling because I am downsizing my kitchen stuff before moving out at the end of the semester.

Open to reasonable offers on the $50 price. Can meet on campus, and I am happy to walk through the controls in person when you pick it up.',
  JSON_ARRAY('/images/air-fryer.jpg'),
  50.00,
  'Active',
  0,
  1,
  CURDATE(),
  @seller_id,
  0
);

-- Insert Pim Plushie listing (accepts trades, price negotiable)
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
  'Pim Plushie',
  JSON_ARRAY('Decor', 'Games'),
  'North Campus',
  'Like New',
  'Pim plushie from Smiling Friends, the kind of face that looks unimpressed no matter how you pose it on a shelf. No rips, flat spots, or loose stitching anywhere on the plush, and the color is still solid without any fading from sunlight.

This listing is just for the plush itself, no display stand, no other characters, nothing extra bundled in beyond what is shown in the photo. It would work as a shelf decoration next to other figures, or as a gift for a friend who actually watches the show, since the appeal here is really just being Pim.

Open to trades if you have something a Smiling Friends fan would appreciate instead of cash. Otherwise $20, and I can meet up on campus whenever works for you, no rush on timing. Bring a bag if you want to keep it clean on the way home.',
  JSON_ARRAY('/images/pim-plushie.jpg'),
  20.00,
  'Active',
  1,
  1,
  CURDATE(),
  @seller_id,
  0
);

-- Note: Conversations are NOT created here - they should be created naturally via "Message Seller" button in UI
-- The test flow requires users to click "Message Seller" which will create conversations through the API

COMMIT;
