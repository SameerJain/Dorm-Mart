-- Add promo email tracking column to user_accounts table

ALTER TABLE user_accounts 
ADD COLUMN received_intro_promo_email BOOLEAN NOT NULL DEFAULT FALSE;
