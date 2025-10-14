START TRANSACTION;
-- ^ Begin a transaction so the insert is all-or-nothing.

DELETE FROM user_accounts
WHERE email = 'test-change-password@buffalo.edu';

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
  'change-password',
  5,
  2027,
  'test-change-password@buffalo.edu',
  0,
  '$2y$10$GbrdUE1/URrVdrSoa83d1OMfNWeJAuuzyEU4UvMMANKeub4./C.UO',
  NULL,
  0,
  0
);

COMMIT;


