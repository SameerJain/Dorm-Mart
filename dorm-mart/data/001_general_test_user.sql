START TRANSACTION;
-- Seed: general reusable Dorm Mart test account.
-- Purpose: provides testuser@buffalo.edu for login, buyer, and review flows.
-- Safe to rerun: UNIQUE(email) upsert preserves the row when possible.
SET FOREIGN_KEY_CHECKS = 0;

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
  'test',
  'general-test-user',
  5,
  2027,
  'testuser@buffalo.edu',
  0,
  '$2y$10$GbrdUE1/URrVdrSoa83d1OMfNWeJAuuzyEU4UvMMANKeub4./C.UO',
  NULL,
  0,
  0
)
ON DUPLICATE KEY UPDATE
  first_name = VALUES(first_name),
  last_name = VALUES(last_name),
  grad_month = VALUES(grad_month),
  grad_year = VALUES(grad_year),
  email = VALUES(email),
  promotional = VALUES(promotional),
  hash_pass = VALUES(hash_pass),
  hash_auth = VALUES(hash_auth),
  seller = VALUES(seller),
  theme = VALUES(theme);

SET FOREIGN_KEY_CHECKS = 1;
COMMIT;
