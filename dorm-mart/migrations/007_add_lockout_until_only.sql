-- Migration 006: Add ONLY lockout_until column
-- Author: Rate Limiting Fix
-- Date: 2025-10-23
-- Description: Adds only the lockout_until column for rate limiting

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
