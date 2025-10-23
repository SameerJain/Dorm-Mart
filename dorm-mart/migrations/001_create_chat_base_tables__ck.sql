
-- one row per one-to-one conversation
CREATE TABLE conversations (
  conv_id         BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_1          BIGINT UNSIGNED NOT NULL
  user_2          BIGINT UNSIGNED NOT NULL
  user_1_deleted  BOOLEAN NOT NULL DEFAULT FALSE
  user_2_deleted  BOOLEAN NOT NULL DEFAULT FALSE
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB   DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- two rows per chat (one per user)
-- stores each user's read position so you can detect "has read"
CREATE TABLE conversation_participants (
  conv_id         BIGINT NOT NULL,
  user_id         BIGINT UNSIGNED NOT NULL,
  -- null for unopend at all, 0 for none, and msg_id otherwise
  first_unread_msg_id BIGINT NULL,
  unread_count      BIGINT NOT NULL DEFAULT 0,

  PRIMARY KEY (conversation_id, user_id),
  CONSTRAINT fk_cp_conv FOREIGN KEY (conv_id) 
    REFERENCES conversations(conv_id) ON DELETE CASCADE,
  CONSTRAINT fk_cp_user FOREIGN KEY (user_id)
    REFERENCES user_accounts(user_id) ON DELETE CASCADE,
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE messages (
  message_id      BIGINT PRIMARY KEY AUTO_INCREMENT,
  conv_id         BIGINT NOT NULL,
  sender_id       BIGINT UNSIGNED NOT NULL,
  receiver_id     BIGINT UNSIGNED NOT NULL,
  content         TEXT NOT NULL,             
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  edited_at       TIMESTAMP NULL,
  
  FOREIGN KEY (convd) REFERENCES conversations(conv_id),
  FOREIGN KEY (sender_id) REFERENCES users(user_id),
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;