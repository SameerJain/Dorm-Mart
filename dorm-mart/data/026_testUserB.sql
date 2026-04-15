START TRANSACTION;
-- ^ Begin a transaction so the insert is all-or-nothing.
SET SESSION foreign_key_checks = 0;

-- Free UNIQUE(email) if another row already owns testuserB@buffalo.edu (without DELETE,
-- which can fail when messages still reference that user with FK checks on).
UPDATE user_accounts
SET email = CONCAT('__displaced_seed_', user_id, '@invalid.local')
WHERE email = 'testuserB@buffalo.edu' AND user_id <> 59;

-- Fixed user_id 59 must match 011_classmate_notebook_migrations.sql (seller 58/59).
-- Earlier seeds may already consume auto-increment id 59, so plain INSERT can duplicate PK;
-- upsert overwrites row 59 with the canonical testB row when needed.
INSERT INTO user_accounts (
  user_id,
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
  59,
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


