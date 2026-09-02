-- Moderator accounts, chat profanity flags, and user-submitted message reports.

ALTER TABLE user_accounts
  ADD COLUMN role ENUM('user', 'moderator') NOT NULL DEFAULT 'user' AFTER two_factor_enabled,
  ADD COLUMN is_banned BOOLEAN NOT NULL DEFAULT FALSE AFTER role,
  ADD COLUMN banned_at DATETIME NULL DEFAULT NULL AFTER is_banned,
  ADD COLUMN ban_reason VARCHAR(255) NULL DEFAULT NULL AFTER banned_at;

CREATE TABLE IF NOT EXISTS profanity_words (
  word VARCHAR(100) NOT NULL,
  PRIMARY KEY (word)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO profanity_words (word) VALUES
  ('asshole'),
  ('bastard'),
  ('bitch'),
  ('bullshit'),
  ('cunt'),
  ('damn'),
  ('dick'),
  ('fuck'),
  ('fucker'),
  ('fucking'),
  ('hell'),
  ('motherfucker'),
  ('nigger'),
  ('nigga'),
  ('piss'),
  ('prick'),
  ('pussy'),
  ('shit'),
  ('slut'),
  ('whore');

ALTER TABLE messages
  ADD COLUMN is_flagged BOOLEAN NOT NULL DEFAULT FALSE AFTER content,
  ADD INDEX idx_messages_flagged_created (is_flagged, created_at);

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
