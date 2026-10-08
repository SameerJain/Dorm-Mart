-- Per-user unread tracking for each conversation.
CREATE TABLE conversation_participants (
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
