ALTER TABLE user_accounts
  ADD COLUMN two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE AFTER is_protected;
