-- Preserve deleted chat messages for audit/moderation while hiding their content from chat users.

ALTER TABLE messages
  ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL AFTER edited_at;
