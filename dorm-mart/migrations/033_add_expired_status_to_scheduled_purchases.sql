-- 033_add_expired_status_to_scheduled_purchases.sql
-- Adds 'expired' to the status ENUM for auto-expiry of unanswered scheduled purchase requests

ALTER TABLE scheduled_purchase_requests
MODIFY COLUMN status ENUM('pending','accepted','declined','cancelled','expired') NOT NULL DEFAULT 'pending';
