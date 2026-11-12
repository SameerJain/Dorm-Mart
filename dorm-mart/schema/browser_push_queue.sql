-- Shares the originating transaction; rollbacks and deleted prompts cannot send push.
CREATE TABLE browser_push_queue (
  delivery_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  subscription_id BIGINT UNSIGNED NOT NULL,
  message_id BIGINT NULL,
  notification_id BIGINT UNSIGNED NULL,
  payload JSON NOT NULL,
  available_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (delivery_id),
  UNIQUE KEY uq_push_message (subscription_id, message_id),
  UNIQUE KEY uq_push_notification (subscription_id, notification_id),
  INDEX idx_push_due (available_at),
  CONSTRAINT fk_push_delivery_subscription FOREIGN KEY (subscription_id) REFERENCES browser_push_subscriptions(subscription_id) ON DELETE CASCADE,
  CONSTRAINT fk_push_delivery_message FOREIGN KEY (message_id) REFERENCES messages(message_id) ON DELETE CASCADE,
  CONSTRAINT fk_push_delivery_notification FOREIGN KEY (notification_id) REFERENCES notifications(notification_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
