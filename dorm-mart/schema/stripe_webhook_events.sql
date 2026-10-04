-- Stripe webhook events already processed, so a retried event is ignored.

CREATE TABLE stripe_webhook_events (
  webhook_event_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  payment_mode ENUM('test','live') NOT NULL,
  stripe_event_id VARCHAR(255) NOT NULL,
  event_type VARCHAR(128) NOT NULL,
  stripe_object_id VARCHAR(255) NULL DEFAULT NULL,
  processed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (webhook_event_id),
  UNIQUE KEY uq_stripe_webhook_event (payment_mode, stripe_event_id),
  INDEX idx_stripe_webhook_object (stripe_object_id, event_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
