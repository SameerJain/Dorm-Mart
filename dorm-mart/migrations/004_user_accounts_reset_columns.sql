-- Migration 005: Add password reset functionality columns
-- Author: Forgot Password Feature Implementation
-- Date: 2025-10-22
-- Description: Adds columns needed for forgot password feature

-- Add password reset columns to user_accounts table
-- Check if columns exist first to avoid errors
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = DATABASE() 
     AND TABLE_NAME = 'user_accounts' 
     AND COLUMN_NAME = 'reset_token_expires') = 0,
    'ALTER TABLE user_accounts ADD COLUMN reset_token_expires DATETIME NULL DEFAULT NULL COMMENT "When the reset token expires"',
    'SELECT "Column reset_token_expires already exists"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = DATABASE() 
     AND TABLE_NAME = 'user_accounts' 
     AND COLUMN_NAME = 'last_reset_request') = 0,
    'ALTER TABLE user_accounts ADD COLUMN last_reset_request DATETIME NULL DEFAULT NULL COMMENT "When the last reset request was made"',
    'SELECT "Column last_reset_request already exists"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add lockout_until column for rate limiting
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = DATABASE() 
     AND TABLE_NAME = 'user_accounts' 
     AND COLUMN_NAME = 'lockout_until') = 0,
    'ALTER TABLE user_accounts ADD COLUMN lockout_until DATETIME NULL DEFAULT NULL COMMENT "When the account lockout expires"',
    'SELECT "Column lockout_until already exists"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add index for performance on reset token lookups
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
     WHERE TABLE_SCHEMA = DATABASE() 
     AND TABLE_NAME = 'user_accounts' 
     AND INDEX_NAME = 'idx_reset_token_expires') = 0,
    'CREATE INDEX idx_reset_token_expires ON user_accounts (reset_token_expires)',
    'SELECT "Index idx_reset_token_expires already exists"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
