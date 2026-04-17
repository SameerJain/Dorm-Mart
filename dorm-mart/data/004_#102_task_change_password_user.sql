START TRANSACTION;
-- ^ Begin a transaction so the insert is all-or-nothing.
SET SESSION foreign_key_checks = 0;

DELETE FROM user_accounts
WHERE email = 'testuser102@buffalo.edu';

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
  'Test102',
  'User102',
  5,
  2027,
  'testuser102@buffalo.edu',
  0,
  '$2y$10$1Dhol7sfeP/wbSwXgnyuV.8IWS1jc8kEuXnkPQF81kGuhyW1uTNhS',
  NULL,
  0,
  0
);

SET SESSION foreign_key_checks = 1;
COMMIT;


