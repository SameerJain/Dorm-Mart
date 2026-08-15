START TRANSACTION;

-- Seed moderator login: moderator@buffalo.edu / Moderator1234!
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
  theme,
  role,
  is_protected,
  is_banned
) VALUES (
  'Dorm Mart',
  'Moderator',
  5,
  2030,
  'moderator@buffalo.edu',
  0,
  '$2y$10$Lsi17OyY9.zy.qhCZy0G4uSVUVU7TfdkcREh9bXEu0sy1r1SgAfdm',
  NULL,
  0,
  0,
  'moderator',
  1,
  0
)
ON DUPLICATE KEY UPDATE
  first_name = VALUES(first_name),
  last_name = VALUES(last_name),
  hash_pass = VALUES(hash_pass),
  hash_auth = NULL,
  role = 'moderator',
  is_protected = 1,
  is_banned = 0,
  banned_at = NULL,
  ban_reason = NULL;

COMMIT;
