-- Add interested categories columns to user_accounts table

ALTER TABLE user_accounts 
ADD COLUMN interested_category_1 VARCHAR(50) NULL DEFAULT NULL COMMENT 'First interested category from categories.json',
ADD COLUMN interested_category_2 VARCHAR(50) NULL DEFAULT NULL COMMENT 'Second interested category from categories.json',
ADD COLUMN interested_category_3 VARCHAR(50) NULL DEFAULT NULL COMMENT 'Third interested category from categories.json';
