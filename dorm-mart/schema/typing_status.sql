-- Who is currently typing in a conversation.
CREATE TABLE typing_status (
  id INT NOT NULL AUTO_INCREMENT,
  conversation_id BIGINT NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  is_typing TINYINT(1) NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY unique_conv_user (conversation_id, user_id),
  INDEX idx_conv_updated (conversation_id, updated_at),
  CONSTRAINT fk_typing_conv
    FOREIGN KEY (conversation_id) REFERENCES conversations(conv_id) ON DELETE CASCADE,
  CONSTRAINT fk_typing_user
    FOREIGN KEY (user_id) REFERENCES user_accounts(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
