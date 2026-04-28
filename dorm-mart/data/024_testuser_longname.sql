START TRANSACTION;
-- Seed: maximum-length user fields.
-- Purpose: creates a long-name, max-length email test account.
-- Notes: password is 1234!, using the same hash as other test accounts.
-- Full email address (copy-paste ready):
-- wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww@buffalo.edu

SET FOREIGN_KEY_CHECKS = 0;
DELETE FROM user_accounts
WHERE email = CONCAT(REPEAT('w', 242), '@buffalo.edu');

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
  REPEAT('w', 30),
  REPEAT('w', 30),
  5,
  2027,
  CONCAT(REPEAT('w', 242), '@buffalo.edu'),
  0,
  '$2y$10$GbrdUE1/URrVdrSoa83d1OMfNWeJAuuzyEU4UvMMANKeub4./C.UO',
  NULL,
  0,
  0
);
SET FOREIGN_KEY_CHECKS = 1;
COMMIT;
