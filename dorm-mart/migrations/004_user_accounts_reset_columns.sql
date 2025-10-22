-- Migration 005: Add password reset functionality columns
-- Author: Forgot Password Feature Implementation
-- Date: 2025-10-22
-- Description: Adds columns needed for forgot password feature

-- Add password reset columns to user_accounts table (if they don't exist)
ALTER TABLE user_accounts 
ADD COLUMN IF NOT EXISTS reset_token_expires DATETIME NULL DEFAULT NULL COMMENT 'When the reset token expires',
ADD COLUMN IF NOT EXISTS last_reset_request DATETIME NULL DEFAULT NULL COMMENT 'When the last reset request was made';

-- Add index for performance on reset token lookups (if it doesn't exist)
CREATE INDEX IF NOT EXISTS idx_reset_token_expires ON user_accounts (reset_token_expires);
