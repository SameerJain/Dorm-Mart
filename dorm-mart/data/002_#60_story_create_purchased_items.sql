START TRANSACTION;
-- ^ Make the whole operation all-or-nothing.

-- 1) Pull the buyer's user_id into a session variable
SELECT user_id INTO @buyer_id
FROM user_accounts
WHERE email = 'test-buyer@buffalo.edu'
LIMIT 1;

-- 2) Pull the seller's user_id into a session variable
SELECT user_id, first_name, last_name INTO @seller_id, @seller_first_name, @seller_last_name
FROM user_accounts
WHERE email = 'test-seller@buffalo.edu'
LIMIT 1;

DELETE FROM purchased_items
WHERE buyer_user_id = @buyer_id
  AND seller_user_id = @seller_id
  AND title IN ('Wireless Mouse','Keyboard');

-- 3) Insert purchased items using the captured IDs
INSERT INTO purchased_items (
  title,            -- item title
  sold_by,          -- your schema keeps this as a VARCHAR; using seller's email for now
  transacted_at,    -- when the purchase happened
  buyer_user_id,    -- FK → user_accounts(user_id)
  seller_user_id,   -- FK → user_accounts(user_id)
  image_url         -- optional
) VALUES
  ('Wireless Mouse', CONCAT(@seller_first_name, ' ', @seller_last_name), NOW(), @buyer_id, @seller_id, 'https://external-content.duckduckgo.com/iu/?u=https%3A%2F%2Fmytarget.my%2Fwp-content%2Fuploads%2F2021%2F01%2FLOGITECH-WIRELESS-MOUSE-M185-BLUE-2048x2048.jpg&f=1&nofb=1&ipt=522298799c48978a253f330e6e16be5c273a856e85e6e2e45f3dd22ef7ec2956'),
  ('Keyboard', CONCAT(@seller_first_name, ' ', @seller_last_name), DATE_SUB(NOW(), INTERVAL 1 YEAR), @buyer_id, @seller_id, 'https://external-content.duckduckgo.com/iu/?u=https%3A%2F%2Fm.media-amazon.com%2Fimages%2FI%2F71DYlRN51tL._AC_SL1500_.jpg&f=1&nofb=1&ipt=f8721f027b4d0e8db4c1b963de2a05f6e129316e496fd59c18621153ef7d6fe4');

COMMIT;
