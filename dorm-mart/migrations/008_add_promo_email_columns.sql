-- Add promo email tracking columns to user_accounts table

ALTER TABLE user_accounts 
ADD COLUMN received_intro_promo_email BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN prefers_emails BOOLEAN NOT NULL DEFAULT FALSE;
