ALTER TABLE user_accounts
  ADD COLUMN promo_frequency ENUM('off','daily','weekly') NOT NULL DEFAULT 'off' AFTER promotional,
  ADD COLUMN promo_last_sent_at DATETIME NULL DEFAULT NULL AFTER promo_frequency;

UPDATE user_accounts SET promo_frequency = IF(promotional = 1, 'weekly', 'off');
