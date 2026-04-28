<?php

// Dev-only utility — block all web access
if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => false, 'error' => 'Forbidden']);
    exit;
}

// Include security utilities
require_once __DIR__ . '/../security/security.php';

/**
 * Reset All Active Lockouts - Development Utility
 * 
 * This script resets all active rate limiting lockouts for all sessions.
 * Run this script whenever you need to clear all lockouts during testing.
 * 
 * NOTE: Rate limiting is now session-based instead of email-based.
 * This script resets all sessions, not individual user accounts.
 * 
 * COMMAND LINE USAGE:
 * 
 * Reset all lockouts (command line):
 *   php api/utility/reset_user_account_lockouts.php
 * 
 * EXAMPLES:
 * php api/utility/reset_user_account_lockouts.php
 * 
 * NOTES:
 * - This script resets failed_login_attempts to 0 and clears last_failed_attempt and lockout_until for all sessions
 * - All sessions can then attempt login without rate limiting restrictions
 * - Use this during development/testing to reset rate limits
 * - CLI only; web access is intentionally blocked
 * - For resetting a single session, use reset_session_lockout.php instead
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

    // Reset all failed login attempts and lockouts for all sessions
    $stmt = $conn->prepare('UPDATE login_rate_limits SET failed_login_attempts = 0, last_failed_attempt = NULL, lockout_until = NULL');
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
            'affected_sessions' => $affectedRows,
            'reset_time' => $currentTime,
            'note' => 'All sessions can now attempt login without rate limiting restrictions.'
        ]
    ];

    if (php_sapi_name() === 'cli') {
        echo "SUCCESS: All rate limiting lockouts have been reset!\n";
        echo "Affected sessions: $affectedRows\n";
        echo "Reset time: $currentTime\n";
        echo "All sessions can now attempt login without restrictions.\n";
    } else {
        echo json_encode($response, JSON_PRETTY_PRINT);
    }
} catch (Exception $e) {
    // XSS PROTECTION: Escape exception message to prevent XSS
    $errorResponse = [
        'success' => false,
        'error' => 'Failed to reset lockouts',
        'message' => escape_html($e->getMessage())
    ];

    if (php_sapi_name() === 'cli') {
        echo "ERROR: Failed to reset lockouts\n";
        echo "Details: " . $e->getMessage() . "\n";
    } else {
        http_response_code(500);
        echo json_encode($errorResponse, JSON_PRETTY_PRINT);
    }
}
