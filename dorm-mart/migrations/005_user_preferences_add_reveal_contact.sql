-- 005_user_preferences_add_reveal_contact.sql

ALTER TABLE user_preferences
  ADD COLUMN reveal_contact TINYINT(1) NOT NULL DEFAULT 0 AFTER promo_emails;