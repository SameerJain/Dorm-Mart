-- Every account: profile, credentials, moderation state and notification preferences.
CREATE TABLE user_accounts (
  user_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  grad_month TINYINT UNSIGNED NOT NULL,
  grad_year YEAR NOT NULL,
  email VARCHAR(255) NOT NULL,

  promotional BOOLEAN NOT NULL DEFAULT FALSE,
  promo_frequency ENUM('off','daily','weekly') NOT NULL DEFAULT 'off',
  promo_last_sent_at DATETIME NULL DEFAULT NULL,

  -- Credentials. hash_auth is the remember-me token; reset_token_hash is the
  -- password-reset link. auth_version invalidates live sessions when bumped.
  hash_pass VARCHAR(255) NOT NULL,
  hash_auth VARCHAR(255) DEFAULT NULL,
  reset_token_hash VARCHAR(255) NULL DEFAULT NULL,
  auth_version INT UNSIGNED NOT NULL DEFAULT 1,
  is_protected TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Shared demo account: password and deletion are locked',
  two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,

  role ENUM('user', 'moderator') NOT NULL DEFAULT 'user',
  is_banned BOOLEAN NOT NULL DEFAULT FALSE,
  banned_at DATETIME NULL DEFAULT NULL,
  ban_reason VARCHAR(255) NULL DEFAULT NULL,

  join_date DATE NOT NULL DEFAULT (CURRENT_DATE),
  seller BOOLEAN NOT NULL DEFAULT FALSE,
  theme BOOLEAN NOT NULL DEFAULT FALSE,
  reset_token_expires DATETIME NULL DEFAULT NULL,
  last_reset_request DATETIME NULL DEFAULT NULL,

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
  CONSTRAINT chk_user_grad_month CHECK (grad_month BETWEEN 1 AND 12)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
