START TRANSACTION;
-- Seed: paired testuserA@ and testuserB@ accounts.
-- Purpose: supports the Classmate Notebook flow and other buyer/seller tests.
-- Safe to rerun: UNIQUE(email) upserts preserve rows when possible.

SET SESSION foreign_key_checks = 0;

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
  'testA',
  'general-test-user',
  5,
  2027,
  'testuserA@buffalo.edu',
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
  'testB',
  'general-test-user',
  5,
  2027,
  'testuserB@buffalo.edu',
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

SET SESSION foreign_key_checks = 1;
COMMIT;
