-- Dorm Mart schema baseline.
--
-- The complete schema a fresh database starts from. It is the end state of the
-- old migration chain (now in migrations/legacy/), minus two tables nothing
-- uses any more:
--   wishlist_notification         write-only counter, superseded by notifications
--   account_creation_rate_limits  merged into login_rate_limits (namespaced keys)
-- and minus five indexes that repeated the leading column of a unique key.
--
-- Existing databases never run this file. migrate_schema.php finishes their
-- legacy chain and records this baseline as applied; 003_drop_unused_tables.sql
-- then removes the two tables from them. New schema changes go in 004_*.sql
-- onward.
--
-- Electronic payments (Stripe) live in 002_stripe_connect_payments.sql, which
-- runs only when payments are enabled.

-- ---------------------------------------------------------------------------
-- Accounts
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS user_accounts (
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

  reveal_contact_info BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Whether seller allows buyers to see their contact info',
  phone_number VARCHAR(25) NULL,
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

-- Throttle buckets for login, 2FA issuance, account creation and other flows.
-- session_id holds an opaque (usually hashed) key namespaced by flow.
CREATE TABLE IF NOT EXISTS login_rate_limits (
  session_id VARCHAR(128) NOT NULL,
  failed_login_attempts INT UNSIGNED NOT NULL DEFAULT 0,
  last_failed_attempt TIMESTAMP NULL DEFAULT NULL,
  lockout_until DATETIME NULL DEFAULT NULL COMMENT 'When the lockout expires',

  PRIMARY KEY (session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Successful logins, shown on the Logged Devices settings page.
CREATE TABLE IF NOT EXISTS login_history (
  login_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  session_hash CHAR(64) NOT NULL,
  device_type VARCHAR(20) NOT NULL,
  browser VARCHAR(80) NOT NULL,
  operating_system VARCHAR(80) NOT NULL,
  user_agent VARCHAR(512) NOT NULL,
  ip_address VARCHAR(45) NOT NULL,
  location VARCHAR(160) NULL DEFAULT NULL,
  logged_in_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  signed_out_at DATETIME NULL DEFAULT NULL,

  PRIMARY KEY (login_id),
  UNIQUE KEY uq_login_history_session (session_hash),
  INDEX idx_login_history_user_seen (user_id, last_seen_at),
  CONSTRAINT fk_login_history_user
    FOREIGN KEY (user_id) REFERENCES user_accounts(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Listings
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS INVENTORY (
  product_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  title VARCHAR(255) NOT NULL,
  categories JSON DEFAULT NULL,
  item_location VARCHAR(100) DEFAULT NULL,
  item_condition VARCHAR(100) DEFAULT NULL,
  description TEXT DEFAULT NULL,
  photos JSON DEFAULT NULL,
  listing_price FLOAT DEFAULT 0,
  item_status ENUM('Active','Pending','Draft','Sold') NOT NULL DEFAULT 'Active',
  trades BOOLEAN DEFAULT FALSE,
  price_nego BOOLEAN DEFAULT FALSE,
  date_listed DATE DEFAULT (CURRENT_DATE),
  seller_id BIGINT UNSIGNED NOT NULL,
  sold BOOLEAN DEFAULT FALSE,
  final_price FLOAT DEFAULT NULL,
  date_sold DATE DEFAULT NULL,
  sold_to BIGINT UNSIGNED DEFAULT NULL,
  wishlisted INT UNSIGNED NOT NULL DEFAULT 0,
  view_count INT UNSIGNED NOT NULL DEFAULT 0,

  PRIMARY KEY (product_id),
  INDEX idx_seller_id (seller_id),
  INDEX idx_sold_to (sold_to),
  INDEX idx_sold (sold),
  INDEX idx_item_status (item_status),
  INDEX idx_date_listed (date_listed)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS wishlist (
  wishlist_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (wishlist_id),
  UNIQUE KEY uq_user_product (user_id, product_id),
  INDEX idx_product_id (product_id),
  CONSTRAINT fk_wishlist_user
    FOREIGN KEY (user_id) REFERENCES user_accounts(user_id) ON DELETE CASCADE,
  CONSTRAINT fk_wishlist_product
    FOREIGN KEY (product_id) REFERENCES INVENTORY(product_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Buyer engagement signals that personalize the For You feed.
CREATE TABLE IF NOT EXISTS user_listing_behavior (
  user_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  view_count INT UNSIGNED NOT NULL DEFAULT 0,
  is_wishlisted BOOLEAN NOT NULL DEFAULT FALSE,
  last_interacted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (user_id, product_id),
  INDEX idx_behavior_user_updated (user_id, last_interacted_at),
  CONSTRAINT fk_behavior_user
    FOREIGN KEY (user_id) REFERENCES user_accounts(user_id) ON DELETE CASCADE,
  CONSTRAINT fk_behavior_product
    FOREIGN KEY (product_id) REFERENCES INVENTORY(product_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Chat
-- ---------------------------------------------------------------------------

-- User ids are nullable so a deleted account leaves the other side's history.
CREATE TABLE IF NOT EXISTS conversations (
  conv_id BIGINT NOT NULL AUTO_INCREMENT,
  user1_id BIGINT UNSIGNED NULL,
  user2_id BIGINT UNSIGNED NULL,
  product_id BIGINT UNSIGNED NULL DEFAULT NULL,
  item_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  user1_fname VARCHAR(200) NOT NULL,
  user2_fname VARCHAR(200) NOT NULL,
  user1_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  user2_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (conv_id),
  UNIQUE KEY uq_conv_users_product (user1_id, user2_id, product_id),
  CONSTRAINT fk_conv_product
    FOREIGN KEY (product_id) REFERENCES INVENTORY(product_id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS conversation_participants (
  conv_id BIGINT NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  first_unread_msg_id BIGINT NULL,
  unread_count BIGINT NOT NULL DEFAULT 0,

  PRIMARY KEY (conv_id, user_id),
  CONSTRAINT fk_cp_conv
    FOREIGN KEY (conv_id) REFERENCES conversations(conv_id) ON DELETE CASCADE,
  CONSTRAINT fk_cp_user
    FOREIGN KEY (user_id) REFERENCES user_accounts(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- original_content keeps the text before a message's first edit, so moderators
-- see what was actually sent. deleted_at soft-deletes for the same reason.
CREATE TABLE IF NOT EXISTS messages (
  message_id BIGINT NOT NULL AUTO_INCREMENT,
  conv_id BIGINT NOT NULL,
  sender_id BIGINT UNSIGNED NULL,
  receiver_id BIGINT UNSIGNED NULL,
  sender_fname VARCHAR(200) NOT NULL,
  receiver_fname VARCHAR(200) NOT NULL,
  content TEXT NOT NULL,
  original_content TEXT NULL DEFAULT NULL,
  is_flagged BOOLEAN NOT NULL DEFAULT FALSE,
  image_url VARCHAR(255) NULL DEFAULT NULL,
  metadata TEXT NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  edited_at TIMESTAMP NULL,
  deleted_at TIMESTAMP NULL DEFAULT NULL,

  PRIMARY KEY (message_id),
  INDEX idx_messages_flagged_created (is_flagged, created_at),
  CONSTRAINT fk_msg_conv
    FOREIGN KEY (conv_id) REFERENCES conversations(conv_id) ON DELETE CASCADE,
  CONSTRAINT fk_msg_sender
    FOREIGN KEY (sender_id) REFERENCES user_accounts(user_id) ON DELETE SET NULL,
  CONSTRAINT fk_msg_receiver
    FOREIGN KEY (receiver_id) REFERENCES user_accounts(user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS typing_status (
  id INT NOT NULL AUTO_INCREMENT,
  conversation_id BIGINT NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  is_typing TINYINT(1) NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY unique_conv_user (conversation_id, user_id),
  INDEX idx_conv_updated (conversation_id, updated_at),
  CONSTRAINT fk_typing_conv
    FOREIGN KEY (conversation_id) REFERENCES conversations(conv_id) ON DELETE CASCADE,
  CONSTRAINT fk_typing_user
    FOREIGN KEY (user_id) REFERENCES user_accounts(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Purchases
-- ---------------------------------------------------------------------------

-- Product, seller and buyer references are nullable (ON DELETE SET NULL) so a
-- deleted listing or account keeps the other party's records intact.
CREATE TABLE IF NOT EXISTS scheduled_purchase_requests (
  request_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  inventory_product_id BIGINT UNSIGNED NULL,
  seller_user_id BIGINT UNSIGNED NULL,
  buyer_user_id BIGINT UNSIGNED NULL,
  conversation_id BIGINT DEFAULT NULL,
  meet_location VARCHAR(255) NOT NULL,
  meeting_at DATETIME NOT NULL,
  verification_code CHAR(4) NOT NULL,
  description TEXT NULL DEFAULT NULL,
  negotiated_price DECIMAL(10,2) NULL DEFAULT NULL,
  is_trade BOOLEAN NOT NULL DEFAULT FALSE,
  trade_item_description TEXT NULL DEFAULT NULL,
  -- Listing settings captured at scheduling time, restored on acceptance.
  snapshot_price_nego BOOLEAN NOT NULL DEFAULT FALSE,
  snapshot_trades BOOLEAN NOT NULL DEFAULT FALSE,
  snapshot_meet_location VARCHAR(255) NULL DEFAULT NULL,
  status ENUM('pending','accepted','declined','cancelled','expired') NOT NULL DEFAULT 'pending',
  canceled_by_user_id BIGINT UNSIGNED NULL DEFAULT NULL,
  buyer_response_at DATETIME DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (request_id),
  UNIQUE KEY uq_scheduled_purchase_code (verification_code),
  INDEX idx_scheduled_purchase_seller (seller_user_id),
  INDEX idx_scheduled_purchase_buyer (buyer_user_id),
  INDEX idx_scheduled_purchase_status (status),
  INDEX idx_scheduled_purchase_meeting_at (meeting_at),
  INDEX idx_scheduled_purchase_canceled_by (canceled_by_user_id),
  CONSTRAINT fk_sched_purchase_inventory
    FOREIGN KEY (inventory_product_id) REFERENCES INVENTORY(product_id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_sched_purchase_seller
    FOREIGN KEY (seller_user_id) REFERENCES user_accounts(user_id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_sched_purchase_buyer
    FOREIGN KEY (buyer_user_id) REFERENCES user_accounts(user_id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_sched_purchase_conversation
    FOREIGN KEY (conversation_id) REFERENCES conversations(conv_id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_sched_purchase_canceled_by
    FOREIGN KEY (canceled_by_user_id) REFERENCES user_accounts(user_id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- The seller's Confirm Purchase form; the buyer accepts, declines, or it
-- auto-accepts at expires_at.
CREATE TABLE IF NOT EXISTS confirm_purchase_requests (
  confirm_request_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  scheduled_request_id BIGINT UNSIGNED NOT NULL,
  inventory_product_id BIGINT UNSIGNED NULL,
  seller_user_id BIGINT UNSIGNED NULL,
  buyer_user_id BIGINT UNSIGNED NULL,
  conversation_id BIGINT NOT NULL,
  is_successful BOOLEAN NOT NULL DEFAULT TRUE,
  final_price DECIMAL(10,2) NULL DEFAULT NULL,
  seller_notes TEXT NULL DEFAULT NULL,
  failure_reason ENUM('buyer_no_show','insufficient_funds','other') NULL DEFAULT NULL,
  failure_reason_notes TEXT NULL DEFAULT NULL,
  status ENUM('pending','buyer_accepted','buyer_declined','auto_accepted','seller_cancelled') NOT NULL DEFAULT 'pending',
  expires_at DATETIME NOT NULL,
  buyer_response_at DATETIME NULL DEFAULT NULL,
  auto_processed_at DATETIME NULL DEFAULT NULL,
  payload_snapshot JSON NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (confirm_request_id),
  INDEX idx_confirm_sched (scheduled_request_id),
  INDEX idx_confirm_inventory (inventory_product_id),
  INDEX idx_confirm_status (status),
  INDEX idx_confirm_expires_at (expires_at),
  CONSTRAINT fk_confirm_sched
    FOREIGN KEY (scheduled_request_id) REFERENCES scheduled_purchase_requests(request_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_confirm_inventory
    FOREIGN KEY (inventory_product_id) REFERENCES INVENTORY(product_id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_confirm_seller
    FOREIGN KEY (seller_user_id) REFERENCES user_accounts(user_id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_confirm_buyer
    FOREIGN KEY (buyer_user_id) REFERENCES user_accounts(user_id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_confirm_conversation
    FOREIGN KEY (conversation_id) REFERENCES conversations(conv_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT chk_confirm_payload_valid CHECK (payload_snapshot IS NULL OR JSON_VALID(payload_snapshot)),
  CONSTRAINT chk_confirm_final_price CHECK (final_price IS NULL OR final_price >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Purchases recorded before purchase_history existed. Nothing writes here any
-- more; purchase_history.php still shows these rows. item_id is this table's
-- own counter, not a listing id.
CREATE TABLE IF NOT EXISTS purchased_items (
  item_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  title VARCHAR(200) NOT NULL,
  sold_by VARCHAR(100) NOT NULL,
  transacted_at DATETIME NOT NULL,
  buyer_user_id BIGINT UNSIGNED NULL,
  seller_user_id BIGINT UNSIGNED NULL,
  image_url VARCHAR(500) DEFAULT NULL,

  PRIMARY KEY (item_id),
  KEY idx_transacted_at (transacted_at),
  KEY idx_buyer_user_id (buyer_user_id),
  KEY idx_seller_user_id (seller_user_id),
  CONSTRAINT fk_purchased_items_buyer
    FOREIGN KEY (buyer_user_id) REFERENCES user_accounts(user_id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_purchased_items_seller
    FOREIGN KEY (seller_user_id) REFERENCES user_accounts(user_id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- A buyer's completed purchases as a JSON list of
-- {product_id, recorded_at, confirm_payload} entries (see record_purchase_history).
CREATE TABLE IF NOT EXISTS purchase_history (
  history_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  items JSON NOT NULL DEFAULT (JSON_ARRAY()),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (history_id),
  UNIQUE KEY uq_purchase_history_user (user_id),
  CONSTRAINT fk_purchase_history_user
    FOREIGN KEY (user_id) REFERENCES user_accounts(user_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT chk_purchase_history_items CHECK (JSON_VALID(items))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Reviews
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS product_reviews (
  review_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id BIGINT UNSIGNED NOT NULL,
  buyer_user_id BIGINT UNSIGNED NOT NULL,
  seller_user_id BIGINT UNSIGNED NOT NULL,
  rating DECIMAL(2,1) NOT NULL,
  product_rating DECIMAL(2,1) NULL DEFAULT NULL,
  review_text TEXT NOT NULL,
  image1_url TEXT NULL,
  image2_url TEXT NULL,
  image3_url TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (review_id),
  UNIQUE KEY uq_buyer_product_review (buyer_user_id, product_id),
  INDEX idx_product_id (product_id),
  INDEX idx_seller_user_id (seller_user_id),
  INDEX idx_rating (rating),
  INDEX idx_created_at (created_at),
  CONSTRAINT fk_review_product
    FOREIGN KEY (product_id) REFERENCES INVENTORY(product_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_review_buyer
    FOREIGN KEY (buyer_user_id) REFERENCES user_accounts(user_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_review_seller
    FOREIGN KEY (seller_user_id) REFERENCES user_accounts(user_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT chk_rating_range CHECK (rating >= 0 AND rating <= 5),
  CONSTRAINT chk_rating_increment CHECK (rating * 2 = FLOOR(rating * 2))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- A seller's rating of the buyer they sold to.
CREATE TABLE IF NOT EXISTS buyer_ratings (
  rating_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id BIGINT UNSIGNED NOT NULL,
  seller_user_id BIGINT UNSIGNED NOT NULL,
  buyer_user_id BIGINT UNSIGNED NOT NULL,
  rating DECIMAL(2,1) NOT NULL,
  review_text TEXT NOT NULL COMMENT 'Review text from seller about buyer experience',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (rating_id),
  UNIQUE KEY uq_seller_buyer_product_rating (seller_user_id, buyer_user_id, product_id),
  INDEX idx_product_id (product_id),
  INDEX idx_buyer_user_id (buyer_user_id),
  INDEX idx_rating (rating),
  INDEX idx_created_at (created_at),
  CONSTRAINT fk_buyer_rating_product
    FOREIGN KEY (product_id) REFERENCES INVENTORY(product_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_buyer_rating_seller
    FOREIGN KEY (seller_user_id) REFERENCES user_accounts(user_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_buyer_rating_buyer
    FOREIGN KEY (buyer_user_id) REFERENCES user_accounts(user_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT chk_buyer_rating_range CHECK (rating >= 0 AND rating <= 5),
  CONSTRAINT chk_buyer_rating_increment CHECK (rating * 2 = FLOOR(rating * 2))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS notifications (
  notification_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  recipient_user_id BIGINT UNSIGNED NOT NULL,
  type VARCHAR(50) NOT NULL,
  product_id BIGINT UNSIGNED NULL,
  scheduled_request_id BIGINT UNSIGNED NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  image_url VARCHAR(255) NULL,
  severity ENUM('info','success','warning','urgent') NOT NULL DEFAULT 'info',
  destination VARCHAR(500) NULL,
  metadata JSON NULL,
  idempotency_key VARCHAR(191) NOT NULL,
  available_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (notification_id),
  UNIQUE KEY uq_notification_idempotency (idempotency_key),
  INDEX idx_notifications_recipient_available (recipient_user_id, available_at, created_at),
  INDEX idx_notifications_product (product_id),
  INDEX idx_notifications_schedule (scheduled_request_id),
  CONSTRAINT fk_notifications_recipient FOREIGN KEY (recipient_user_id)
    REFERENCES user_accounts(user_id) ON DELETE CASCADE,
  CONSTRAINT fk_notifications_product FOREIGN KEY (product_id)
    REFERENCES INVENTORY(product_id) ON DELETE SET NULL,
  CONSTRAINT fk_notifications_schedule FOREIGN KEY (scheduled_request_id)
    REFERENCES scheduled_purchase_requests(request_id) ON DELETE CASCADE,
  CONSTRAINT chk_notification_metadata CHECK (metadata IS NULL OR JSON_VALID(metadata))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Moderation
-- ---------------------------------------------------------------------------

-- Blocked chat words. seed_profanity_wordlist.php adds the full list on top of
-- these starters.
CREATE TABLE IF NOT EXISTS profanity_words (
  word VARCHAR(100) NOT NULL,
  PRIMARY KEY (word)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO profanity_words (word) VALUES
  ('asshole'), ('bastard'), ('bitch'), ('bullshit'), ('cunt'), ('damn'), ('dick'),
  ('fuck'), ('fucker'), ('fucking'), ('hell'), ('motherfucker'), ('nigger'), ('nigga'),
  ('piss'), ('prick'), ('pussy'), ('shit'), ('slut'), ('whore');

CREATE TABLE IF NOT EXISTS message_reports (
  report_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  message_id BIGINT NOT NULL,
  reporter_id BIGINT UNSIGNED NULL,
  reported_user_id BIGINT UNSIGNED NULL,
  reason VARCHAR(255) NOT NULL,
  status ENUM('open', 'resolved', 'dismissed') NOT NULL DEFAULT 'open',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at DATETIME NULL DEFAULT NULL,
  resolved_by BIGINT UNSIGNED NULL,

  PRIMARY KEY (report_id),
  UNIQUE KEY uq_message_reporter (message_id, reporter_id),
  INDEX idx_reports_status_created (status, created_at),
  CONSTRAINT fk_report_message
    FOREIGN KEY (message_id) REFERENCES messages(message_id) ON DELETE CASCADE,
  CONSTRAINT fk_report_reporter
    FOREIGN KEY (reporter_id) REFERENCES user_accounts(user_id) ON DELETE SET NULL,
  CONSTRAINT fk_report_reported_user
    FOREIGN KEY (reported_user_id) REFERENCES user_accounts(user_id) ON DELETE SET NULL,
  CONSTRAINT fk_report_resolver
    FOREIGN KEY (resolved_by) REFERENCES user_accounts(user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- The title is snapshotted because removing a listing deletes the row the
-- report points at.
CREATE TABLE IF NOT EXISTS listing_reports (
  report_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id BIGINT UNSIGNED NULL,
  seller_id BIGINT UNSIGNED NULL,
  reporter_id BIGINT UNSIGNED NULL,
  listing_title VARCHAR(255) NOT NULL,
  reason VARCHAR(32) NOT NULL,
  details VARCHAR(500) NULL,
  status ENUM('open', 'removed', 'dismissed') NOT NULL DEFAULT 'open',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at DATETIME NULL DEFAULT NULL,
  resolved_by BIGINT UNSIGNED NULL,

  PRIMARY KEY (report_id),
  UNIQUE KEY uq_listing_reporter (product_id, reporter_id),
  INDEX idx_listing_reports_status_created (status, created_at),
  CONSTRAINT fk_listing_report_product
    FOREIGN KEY (product_id) REFERENCES INVENTORY(product_id) ON DELETE SET NULL,
  CONSTRAINT fk_listing_report_seller
    FOREIGN KEY (seller_id) REFERENCES user_accounts(user_id) ON DELETE SET NULL,
  CONSTRAINT fk_listing_report_reporter
    FOREIGN KEY (reporter_id) REFERENCES user_accounts(user_id) ON DELETE SET NULL,
  CONSTRAINT fk_listing_report_resolver
    FOREIGN KEY (resolved_by) REFERENCES user_accounts(user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Audit trail of moderator decisions (bans, report outcomes, word-list edits).
CREATE TABLE IF NOT EXISTS moderation_actions (
  action_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  moderator_id BIGINT UNSIGNED NULL,
  action VARCHAR(40) NOT NULL,
  target_user_id BIGINT UNSIGNED NULL,
  target_type VARCHAR(20) NULL,
  target_id BIGINT UNSIGNED NULL,
  details VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (action_id),
  INDEX idx_moderation_actions_created (created_at),
  INDEX idx_moderation_actions_target_user (target_user_id, created_at),
  CONSTRAINT fk_moderation_action_moderator
    FOREIGN KEY (moderator_id) REFERENCES user_accounts(user_id) ON DELETE SET NULL,
  CONSTRAINT fk_moderation_action_target_user
    FOREIGN KEY (target_user_id) REFERENCES user_accounts(user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
