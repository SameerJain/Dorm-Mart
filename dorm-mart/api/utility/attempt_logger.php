<?php
/**
 * Login Attempt Logger
 * 
 * This script logs all login attempts and decay events to a file for monitoring.
 * Add this to your login.php file to track all activity.
 * 
 * COMMAND LINE USAGE:
 * ===================
 * 
 * View recent log entries:
 *   php api/utility/attempt_logger.php view [lines]
 *   Example: php api/utility/attempt_logger.php view 20
 * 
 * Clear all logs:
 *   php api/utility/attempt_logger.php clear
 * 
 * Show help:
 *   php api/utility/attempt_logger.php help
 * 
 * EXAMPLES:
 * =========
 * php api/utility/attempt_logger.php view 50    # Show last 50 entries
 * php api/utility/attempt_logger.php view       # Show last 50 entries (default)
 * php api/utility/attempt_logger.php clear      # Clear all logs
 * php api/utility/attempt_logger.php help      # Show usage help
 */

require_once __DIR__ . '/../database/db_connect.php';

/**
 * Log a login attempt
 */
function log_attempt($email, $success, $attempts, $action = '') {
    $timestamp = date('Y-m-d H:i:s');
    $status = $success ? 'SUCCESS' : 'FAILED';
    $logEntry = "[$timestamp] $status | $email | Attempts: $attempts | $action\n";
    
    file_put_contents(__DIR__ . '/attempts.log', $logEntry, FILE_APPEND | LOCK_EX);
}

/**
 * Log decay events
 */
function log_decay($email, $oldAttempts, $newAttempts, $decayCycles) {
    $timestamp = date('Y-m-d H:i:s');
    $logEntry = "[$timestamp] DECAY | $email | $oldAttempts → $newAttempts | Cycles: $decayCycles\n";
    
    file_put_contents(__DIR__ . '/attempts.log', $logEntry, FILE_APPEND | LOCK_EX);
}

/**
 * Log rate limiting events
 */
function log_rate_limit($email, $action, $details = '') {
    $timestamp = date('Y-m-d H:i:s');
    $logEntry = "[$timestamp] RATE_LIMIT | $email | $action | $details\n";
    
    file_put_contents(__DIR__ . '/attempts.log', $logEntry, FILE_APPEND | LOCK_EX);
}

/**
 * View the attempt log
 */
function view_log($lines = 50) {
    $logFile = __DIR__ . '/attempts.log';
    
    if (!file_exists($logFile)) {
        echo "No log file found. Start making login attempts to generate logs.\n";
        return;
    }
    
    $logContent = file_get_contents($logFile);
    $logLines = explode("\n", $logContent);
    $logLines = array_filter($logLines); // Remove empty lines
    
    $recentLines = array_slice($logLines, -$lines);
    
    echo "=== RECENT LOGIN ATTEMPTS LOG ===\n";
    echo "Showing last $lines entries:\n";
    echo str_repeat("-", 80) . "\n";
    
    foreach ($recentLines as $line) {
        if (trim($line)) {
            echo $line . "\n";
        }
    }
    
    echo str_repeat("-", 80) . "\n";
    echo "Total entries: " . count($logLines) . "\n";
}

// If called from command line with 'view' argument
if (isset($argv[1]) && $argv[1] === 'view') {
    $lines = isset($argv[2]) ? (int)$argv[2] : 50;
    view_log($lines);
    exit(0);
}

// If called from command line with 'clear' argument
if (isset($argv[1]) && $argv[1] === 'clear') {
    $logFile = __DIR__ . '/attempts.log';
    if (file_exists($logFile)) {
        unlink($logFile);
        echo "Log file cleared.\n";
    } else {
        echo "No log file to clear.\n";
    }
    exit(0);
}

// If called from command line with 'help' argument
if (isset($argv[1]) && $argv[1] === 'help') {
    echo "Login Attempt Logger\n";
    echo "Usage:\n";
    echo "  php api/utility/attempt_logger.php view [lines]  - View recent log entries\n";
    echo "  php api/utility/attempt_logger.php clear        - Clear the log file\n";
    echo "  php api/utility/attempt_logger.php help         - Show this help\n";
    echo "\n";
    echo "Examples:\n";
    echo "  php api/utility/attempt_logger.php view 20     - Show last 20 entries\n";
    echo "  php api/utility/attempt_logger.php view         - Show last 50 entries\n";
    echo "  php api/utility/attempt_logger.php clear       - Clear all logs\n";
    exit(0);
}
?>

