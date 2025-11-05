<?php

// Include security utilities
require_once __DIR__ . '/../security/security.php';
setSecurityHeaders();
setSecureCORS();

/**
 * Reset All Active Lockouts - Development Utility
 * 
 * This script resets all active rate limiting lockouts for local development.
 * Run this script whenever you need to clear lockouts during testing.
 * 
 * COMMAND LINE USAGE:
 * ===================
 * 
 * Reset all lockouts (command line):
 *   php api/utility/reset_user_account_lockouts.php
 * 
 * EXAMPLES:
 * =========
 * php api/utility/reset_user_account_lockouts.php
 * 
 * WEB BROWSER USAGE:
 * ==================
 * 
 * 1. NPM START METHOD (React Dev Server):
 *    - Start React dev server: npm start
 *    - Start PHP server: C:\xampp\php\php.exe -S localhost:8080 -t .
 *    - Open browser: http://localhost:3000/api/auth/utility/reset_lockouts.php
 * 
 * 2. NPM BUILD METHOD (Production Build):
 *    - Build React app: npm run build
 *    - Start PHP server: C:\xampp\php\php.exe -S localhost:8080 -t .
 *    - Open browser: http://localhost:8080/api/auth/utility/reset_lockouts.php
 * 
 * NOTES:
 * ======
 * - This script resets failed_login_attempts to 0 and clears last_failed_attempt
 * - All users can then attempt login without rate limiting restrictions
 * - Use this during development/testing to reset rate limits
 * - Works both from command line and web browser
 */

// Include database connection
require_once __DIR__ . '/../database/db_connect.php';

// Set content type for both web and CLI
// Handles both browser requests and command line execution
if (php_sapi_name() !== 'cli') {
    header('Content-Type: application/json; charset=utf-8');
}

try {
    $conn = db();

    // Reset all failed login attempts and lockouts
    $stmt = $conn->prepare('UPDATE user_accounts SET failed_login_attempts = 0, last_failed_attempt = NULL');
    $stmt->execute();
    $affectedRows = $stmt->affected_rows;
    $stmt->close();

    // Get current database time for confirmation
    $result = $conn->query("SELECT NOW() as db_time");
    $row = $result->fetch_assoc();
    $currentTime = $row['db_time'];

    $conn->close();

    $response = [
        'success' => true,
        'message' => "All rate limiting lockouts have been reset!",
        'details' => [
            'affected_users' => $affectedRows,
            'reset_time' => $currentTime,
            'note' => 'All users can now attempt login without rate limiting restrictions.'
        ]
    ];

    if (php_sapi_name() === 'cli') {
        echo "SUCCESS: All rate limiting lockouts have been reset!\n";
        echo "Affected users: $affectedRows\n";
        echo "Reset time: $currentTime\n";
        echo "All users can now attempt login without restrictions.\n";
    } else {
        echo json_encode($response, JSON_PRETTY_PRINT);
    }
} catch (Exception $e) {
    $errorResponse = [
        'success' => false,
        'error' => 'Failed to reset lockouts',
        'message' => $e->getMessage()
    ];

    if (php_sapi_name() === 'cli') {
        echo "ERROR: Failed to reset lockouts\n";
        echo "Details: " . $e->getMessage() . "\n";
    } else {
        http_response_code(500);
        echo json_encode($errorResponse, JSON_PRETTY_PRINT);
    }
}
