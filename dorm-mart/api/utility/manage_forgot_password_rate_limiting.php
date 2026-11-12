<?php
/**
 * Rate Limiting for Forgot Password Requests
 * Prevents spam and abuse of the password reset functionality
 * 
 * COMMAND LINE USAGE:
 * 
 * Clear all forgot password rate limits:
 *   php api/utility/manage_forgot_password_rate_limiting.php
 * 
 * EXAMPLES:
 * php api/utility/manage_forgot_password_rate_limiting.php
 * 
 * NOTES:
 * - This script clears the last_reset_request timestamp for all users
 * - Users can then request new password reset emails immediately
 * - Rate limit is 10 minutes between requests for all environments
 * - Use this during development/testing to reset rate limits
 */

// NOTE: The per-email check helpers that used to live here were deleted.
// forgot_password.php enforces its own atomic 10-minute limiter in SQL, and
// nothing called check_forgot_password_rate_limit(),
// update_reset_request_timestamp() or get_forgot_password_rate_limit_minutes().
// What remains below is the CLI that clears last_reset_request for all users.

if (basename(__FILE__) === basename($_SERVER['SCRIPT_NAME'])) {
    if (php_sapi_name() !== 'cli') {
        http_response_code(404);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['ok' => false, 'error' => 'Not found']);
        exit;
    }

    require_once __DIR__ . '/../database/db_connect.php';

    $conn = db();
    $stmt = $conn->prepare('UPDATE user_accounts SET last_reset_request = NULL');
    $result = $stmt->execute();
    $affectedRows = $stmt->affected_rows;
    $stmt->close();
    $conn->close();

    if ($result) {
        echo "Forgot password rate limits cleared successfully!\n";
        echo "{$affectedRows} user(s) can now request new password reset emails immediately.\n";
        echo "Rate limit: 10 minutes for all environments\n";
    } else {
        echo "Failed to clear forgot password rate limits.\n";
    }
}
