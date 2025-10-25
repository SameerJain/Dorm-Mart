SET @sql = (SELECT IF(
    (SELECT COUNT() FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = DATABASE() 
     AND TABLE_NAME = 'user_accounts' 
     AND COLUMN_NAME = 'failed_login_attempts') = 0,
    'ALTER TABLE user_accounts ADD COLUMN failed_login_attempts INT UNSIGNED NOT NULL DEFAULT 0 COMMENT "Number of consecutive failed login attempts"',
    'SELECT "Column failed_login_attempts already exists"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add last_failed_attempt 
SET @sql = (SELECT IF(
    (SELECT COUNT() FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = DATABASE() 
     AND TABLE_NAME = 'user_accounts' 
     AND COLUMN_NAME = 'last_failed_attempt') = 0,
    'ALTER TABLE user_accounts ADD COLUMN last_failed_attempt TIMESTAMP NULL DEFAULT NULL COMMENT "When the last failed login attempt occurred"',
    'SELECT "Column last_failed_attempt already exists"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;