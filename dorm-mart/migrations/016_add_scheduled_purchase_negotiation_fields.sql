-- 016_add_scheduled_purchase_negotiation_fields.sql
-- Adds fields to scheduled_purchase_requests table for price negotiation and trade functionality

ALTER TABLE scheduled_purchase_requests
ADD COLUMN negotiated_price DECIMAL(10,2) NULL DEFAULT NULL AFTER description,
ADD COLUMN is_trade BOOLEAN NOT NULL DEFAULT FALSE AFTER negotiated_price,
ADD COLUMN trade_item_description TEXT NULL DEFAULT NULL AFTER is_trade,
ADD COLUMN snapshot_price_nego BOOLEAN NOT NULL DEFAULT FALSE AFTER trade_item_description,
ADD COLUMN snapshot_trades BOOLEAN NOT NULL DEFAULT FALSE AFTER snapshot_price_nego,
ADD COLUMN snapshot_meet_location VARCHAR(255) NULL DEFAULT NULL AFTER snapshot_trades;


