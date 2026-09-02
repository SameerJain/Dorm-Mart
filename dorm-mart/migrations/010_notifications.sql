CREATE TABLE IF NOT EXISTS notifications (
  notification_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  recipient_user_id BIGINT UNSIGNED NOT NULL,
  type VARCHAR(50) NOT NULL,
  product_id BIGINT UNSIGNED NULL,
  scheduled_request_id BIGINT UNSIGNED NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  image_url VARCHAR(255) NULL,
  severity ENUM('info','success','warning','urgent') NOT NULL DEFAULT 'info',
  destination VARCHAR(500) NULL,
  metadata JSON NULL,
  idempotency_key VARCHAR(191) NOT NULL,
  available_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (notification_id),
  UNIQUE KEY uq_notification_idempotency (idempotency_key),
  INDEX idx_notifications_recipient_available (recipient_user_id, available_at, created_at),
  INDEX idx_notifications_product (product_id),
  INDEX idx_notifications_schedule (scheduled_request_id),
  CONSTRAINT fk_notifications_recipient FOREIGN KEY (recipient_user_id)
    REFERENCES user_accounts(user_id) ON DELETE CASCADE,
  CONSTRAINT fk_notifications_product FOREIGN KEY (product_id)
    REFERENCES INVENTORY(product_id) ON DELETE SET NULL,
  CONSTRAINT fk_notifications_schedule FOREIGN KEY (scheduled_request_id)
    REFERENCES scheduled_purchase_requests(request_id) ON DELETE CASCADE,
  CONSTRAINT chk_notification_metadata CHECK (metadata IS NULL OR JSON_VALID(metadata))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO notifications
  (recipient_user_id, type, product_id, title, message, image_url, severity,
   destination, metadata, idempotency_key, available_at)
SELECT seller_id, 'wishlist_added', product_id, title,
       CONCAT('This listing has ', unread_count, ' new wishlist ', IF(unread_count = 1, 'save.', 'saves.')),
       image_url, 'info', CONCAT('/app/viewProduct/', product_id),
       JSON_OBJECT('count', unread_count), CONCAT('legacy-wishlist-', seller_id, '-', product_id), NOW()
FROM wishlist_notification WHERE unread_count > 0;
