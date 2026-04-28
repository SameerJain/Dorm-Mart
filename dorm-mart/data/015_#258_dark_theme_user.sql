START TRANSACTION;
-- Seed: Task #258 dark-theme test account.
-- Purpose: creates testuserdark@buffalo.edu with dark theme enabled.
-- Safe to rerun: removes and recreates only this account.
SET SESSION foreign_key_checks = 0;

DELETE FROM user_accounts
WHERE email = 'testuserdark@buffalo.edu';

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
  'Dark',
  'Theme',
  5,
  2027,
  'testuserdark@buffalo.edu',
  0,
  '$2y$10$Q2O7n9czGpzVG1PuLbB4T.GJ9xXoG6vrmtnS7K9ENxuYXTaDcuoCK',
  NULL,
  0,
  1
);

SET SESSION foreign_key_checks = 1;
COMMIT;
