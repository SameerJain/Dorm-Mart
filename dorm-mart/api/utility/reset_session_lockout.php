<?php

require_once __DIR__ . '/../helpers/response.php';
require_cli();

// Include security utilities
require_once __DIR__ . '/../security/security.php';

// Include auth handle for session management
require_once __DIR__ . '/../auth/auth_handle.php';

/**
 * Reset All Session Lockouts - Development Utility (CLI only).
 *
 * Usage:
 *   php api/utility/reset_session_lockout.php
 */

// Include database connection
require_once __DIR__ . '/../database/db_connect.php';

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
        'message' => "All session rate limiting lockouts have been reset!",
        'details' => [
            'affected_sessions' => $affectedRows,
            'reset_time' => $currentTime,
            'note' => 'All sessions can now attempt login without rate limiting restrictions.'
        ]
    ];

    if (php_sapi_name() === 'cli') {
        echo "SUCCESS: All session rate limiting lockouts have been reset!\n";
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
        'error' => 'Failed to reset session lockouts',
        'message' => escape_html($e->getMessage())
    ];

    if (php_sapi_name() === 'cli') {
        echo "ERROR: Failed to reset session lockouts\n";
        echo "Details: " . $e->getMessage() . "\n";
    } else {
        http_response_code(500);
        echo json_encode($errorResponse, JSON_PRETTY_PRINT);
    }
}

