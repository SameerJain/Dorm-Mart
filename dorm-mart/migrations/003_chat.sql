-- Conversations, messages, participants, and typing indicators.

CREATE TABLE IF NOT EXISTS conversations (
  conv_id BIGINT NOT NULL AUTO_INCREMENT,
  user1_id BIGINT UNSIGNED NOT NULL,
  user2_id BIGINT UNSIGNED NOT NULL,
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
    FOREIGN KEY (product_id)
    REFERENCES INVENTORY(product_id)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS conversation_participants (
  conv_id BIGINT NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  first_unread_msg_id BIGINT NULL,
  unread_count BIGINT NOT NULL DEFAULT 0,

  PRIMARY KEY (conv_id, user_id),
  CONSTRAINT fk_cp_conv
    FOREIGN KEY (conv_id)
    REFERENCES conversations(conv_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_cp_user
    FOREIGN KEY (user_id)
    REFERENCES user_accounts(user_id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS messages (
  message_id BIGINT NOT NULL AUTO_INCREMENT,
  conv_id BIGINT NOT NULL,
  sender_id BIGINT UNSIGNED NOT NULL,
  receiver_id BIGINT UNSIGNED NOT NULL,
  sender_fname VARCHAR(200) NOT NULL,
  receiver_fname VARCHAR(200) NOT NULL,
  content TEXT NOT NULL,
  image_url VARCHAR(255) NULL DEFAULT NULL,
  metadata TEXT NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  edited_at TIMESTAMP NULL,

  PRIMARY KEY (message_id),
  CONSTRAINT fk_msg_conv
    FOREIGN KEY (conv_id)
    REFERENCES conversations(conv_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_msg_sender
    FOREIGN KEY (sender_id)
    REFERENCES user_accounts(user_id),
  CONSTRAINT fk_msg_receiver
    FOREIGN KEY (receiver_id)
    REFERENCES user_accounts(user_id)
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
    FOREIGN KEY (conversation_id)
    REFERENCES conversations(conv_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_typing_user
    FOREIGN KEY (user_id)
    REFERENCES user_accounts(user_id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
