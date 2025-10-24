

DELETE FROM conversations;

-- Optional: reset the auto-increment after the purge
ALTER TABLE conversations AUTO_INCREMENT = 1;

DELETE FROM user_accounts
WHERE email IN (
  'chatuser1@buffalo.edu',
  'chatuser2@buffalo.edu',
  'chatuser3@buffalo.edu'
);

INSERT INTO user_accounts (first_name, last_name, grad_month, grad_year, email, promotional, hash_pass, hash_auth, seller, theme) VALUES
    ('test', 'chatuser1', 5, 2027, 'chatuser1@buffalo.edu', 0,
  '$2y$10$GbrdUE1/URrVdrSoa83d1OMfNWeJAuuzyEU4UvMMANKeub4./C.UO', NULL, 0, 0),
  ('test', 'chatuser2', 5, 2027, 'chatuser2@buffalo.edu', 0,
  '$2y$10$GbrdUE1/URrVdrSoa83d1OMfNWeJAuuzyEU4UvMMANKeub4./C.UO', NULL, 0, 0),
  ('test', 'chatuser3', 5, 2027, 'chatuser3@buffalo.edu', 0,
  '$2y$10$GbrdUE1/URrVdrSoa83d1OMfNWeJAuuzyEU4UvMMANKeub4./C.UO', NULL, 0, 0);

SELECT user_id INTO @uid1 FROM user_accounts WHERE email = 'chatuser1@buffalo.edu' LIMIT 1;  -- stores into @uid1
SELECT user_id INTO @uid2 FROM user_accounts WHERE email = 'chatuser2@buffalo.edu' LIMIT 1;  -- stores into @uid2
SELECT user_id INTO @uid3 FROM user_accounts WHERE email = 'chatuser3@buffalo.edu' LIMIT 1;  -- stores into @uid3

INSERT INTO conversations (user_1, user_2, user_1_deleted, user_2_deleted, created_at)
VALUES
  (@uid1, @uid2, 0, 0, DATE_SUB(NOW(), INTERVAL 7 DAY)),  -- chatuser1 ↔ chatuser2
  (@uid1, @uid3, 0, 0, DATE_SUB(NOW(), INTERVAL 3 DAY));  -- chatuser1 ↔ chatuser3


-- Create participants for the two conversations: (@uid1 ↔ @uid2) and (@uid1 ↔ @uid3)
INSERT INTO conversation_participants (conv_id, user_id, first_unread_msg_id, unread_count)
SELECT c.conv_id, c.user_1 AS user_id, NULL, 0
FROM conversations c
WHERE (c.user_1, c.user_2) IN ((@uid1, @uid2), (@uid1, @uid3))
UNION ALL
SELECT c.conv_id, c.user_2 AS user_id, NULL, 0
FROM conversations c
WHERE (c.user_1, c.user_2) IN ((@uid1, @uid2), (@uid1, @uid3));



SELECT conv_id INTO @conv_1_2
FROM conversations
WHERE (user_1 = @uid1 AND user_2 = @uid2) OR (user_1 = @uid2 AND user_2 = @uid1)
LIMIT 1;

SELECT conv_id INTO @conv_1_3
FROM conversations
WHERE (user_1 = @uid1 AND user_2 = @uid3) OR (user_1 = @uid3 AND user_2 = @uid1)
LIMIT 1;

-- Dummy messages WITH receiver_id (required by your schema)
INSERT INTO messages (conv_id, sender_id, receiver_id, content, created_at) VALUES
  (@conv_1_2, @uid1, @uid2, 'Hey, you free later?',               DATE_SUB(NOW(), INTERVAL 6 DAY)),
  (@conv_1_2, @uid2, @uid1, 'Yeah—what''s up?',                    DATE_ADD(DATE_SUB(NOW(), INTERVAL 6 DAY), INTERVAL 15 MINUTE)),
  (@conv_1_2, @uid1, @uid2, 'Need a quick review.',               DATE_ADD(DATE_SUB(NOW(), INTERVAL 6 DAY), INTERVAL 30 MINUTE)),

  (@conv_1_3, @uid1, @uid3, 'Jamie, pushed the fix.',             DATE_SUB(NOW(), INTERVAL 2 DAY)),
  (@conv_1_3, @uid3, @uid1, 'Got it. Looks good.',                DATE_ADD(DATE_SUB(NOW(), INTERVAL 2 DAY), INTERVAL 10 MINUTE)),
  (@conv_1_3, @uid1, @uid3, 'Merging now.',                       DATE_ADD(DATE_SUB(NOW(), INTERVAL 2 DAY), INTERVAL 20 MINUTE));