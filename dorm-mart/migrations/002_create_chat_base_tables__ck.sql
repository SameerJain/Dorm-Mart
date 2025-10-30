
-- one row per one-to-one conversation
CREATE TABLE conversations (
  conv_id         BIGINT PRIMARY KEY AUTO_INCREMENT,
  user1_id          BIGINT UNSIGNED NOT NULL,
  user2_id          BIGINT UNSIGNED NOT NULL,
  user1_fname     VARCHAR(200) NOT NULL,
  user2_fname     VARCHAR(200) NOT NULL,  
  user1_deleted  BOOLEAN NOT NULL DEFAULT FALSE,
  user2_deleted  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- two rows per chat (one per user)
-- stores each user's read position so you can detect "has read"
CREATE TABLE conversation_participants (
  conv_id             BIGINT NOT NULL,
  user_id             BIGINT UNSIGNED NOT NULL,
  -- NULL = never opened; 0 = no unread; otherwise = first unread message_id
  first_unread_msg_id BIGINT NULL,
  unread_count        BIGINT NOT NULL DEFAULT 0,

  PRIMARY KEY (conv_id, user_id),
  CONSTRAINT fk_cp_conv FOREIGN KEY (conv_id)
    REFERENCES conversations(conv_id) ON DELETE CASCADE,
  CONSTRAINT fk_cp_user FOREIGN KEY (user_id)
    REFERENCES user_accounts(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE messages (
  message_id  BIGINT PRIMARY KEY AUTO_INCREMENT,
  conv_id     BIGINT NOT NULL,
  sender_id   BIGINT UNSIGNED NOT NULL,
  receiver_id BIGINT UNSIGNED NOT NULL,
  sender_fname     VARCHAR(200) NOT NULL,
  receiver_fname     VARCHAR(200) NOT NULL,
  content     TEXT NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  edited_at   TIMESTAMP NULL,

  CONSTRAINT fk_msg_conv    FOREIGN KEY (conv_id)     REFERENCES conversations(conv_id) ON DELETE CASCADE,
  CONSTRAINT fk_msg_sender  FOREIGN KEY (sender_id)   REFERENCES user_accounts(user_id),
  CONSTRAINT fk_msg_receiver FOREIGN KEY (receiver_id) REFERENCES user_accounts(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;