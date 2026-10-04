-- original_content keeps the text before a message's first edit, so moderators
-- see what was actually sent. deleted_at soft-deletes for the same reason.

CREATE TABLE messages (
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
