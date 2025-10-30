-- Add seller contact preference column to user_accounts table

ALTER TABLE user_accounts 
ADD COLUMN reveal_contact_info BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Whether seller allows buyers to see their contact info';
