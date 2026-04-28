-- User accounts and profile/preferences schema.
-- This is the consolidated baseline for the current application schema.

CREATE TABLE IF NOT EXISTS user_accounts (
  user_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,

  grad_month TINYINT UNSIGNED NOT NULL,
  grad_year YEAR NOT NULL,

  email VARCHAR(255) NOT NULL,
  promotional BOOLEAN NOT NULL DEFAULT FALSE,

  hash_pass VARCHAR(255) NOT NULL,
  hash_auth VARCHAR(255) DEFAULT NULL,

  join_date DATE NOT NULL DEFAULT (CURRENT_DATE),
  seller BOOLEAN NOT NULL DEFAULT FALSE,
  theme BOOLEAN NOT NULL DEFAULT FALSE,

  reset_token_expires DATETIME NULL DEFAULT NULL,
  last_reset_request DATETIME NULL DEFAULT NULL,

  reveal_contact_info BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Whether seller allows buyers to see their contact info',
  interested_category_1 VARCHAR(50) NULL DEFAULT NULL COMMENT 'First interested category from categories.json',
  interested_category_2 VARCHAR(50) NULL DEFAULT NULL COMMENT 'Second interested category from categories.json',
  interested_category_3 VARCHAR(50) NULL DEFAULT NULL COMMENT 'Third interested category from categories.json',

  profile_photo VARCHAR(255) NULL DEFAULT NULL COMMENT 'URL or path to the user profile photo',
  bio TEXT NULL COMMENT 'Short biography text supplied by the user',
  instagram VARCHAR(255) NULL DEFAULT NULL COMMENT 'Instagram handle or profile URL',

  buyer_rating DECIMAL(3,2) NULL DEFAULT NULL COMMENT 'Average rating as a buyer',
  seller_rating DECIMAL(3,2) NULL DEFAULT NULL COMMENT 'Average rating as a seller',
  received_intro_promo_email BOOLEAN NOT NULL DEFAULT FALSE,

  PRIMARY KEY (user_id),
  UNIQUE KEY uq_user_email (email),
  CHECK (grad_month BETWEEN 1 AND 12)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
