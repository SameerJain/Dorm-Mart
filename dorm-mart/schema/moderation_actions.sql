-- Audit trail of moderator decisions (bans, report outcomes, word-list edits).

CREATE TABLE moderation_actions (
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
