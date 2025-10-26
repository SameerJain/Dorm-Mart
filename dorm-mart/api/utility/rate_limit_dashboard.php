<?php
/**
 * Rate Limiting Dashboard
 * 
 * This script provides a comprehensive view of all rate limiting activity.
 * 
 * USAGE:
 * php api/utility/rate_limit_dashboard.php
 */

require_once __DIR__ . '/../database/db_connect.php';
require_once __DIR__ . '/../security/security.php';

echo "=== RATE LIMITING DASHBOARD ===\n";
echo "Time: " . date('Y-m-d H:i:s') . "\n";
echo str_repeat("=", 80) . "\n\n";

// Get all users with failed attempts
$conn = db();
$stmt = $conn->prepare('
    SELECT email, failed_login_attempts, last_failed_attempt, user_id 
    FROM user_accounts 
    WHERE failed_login_attempts > 0 OR last_failed_attempt IS NOT NULL
    ORDER BY last_failed_attempt DESC
');
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows === 0) {
    echo "✅ No users with failed login attempts\n";
    $stmt->close();
    $conn->close();
    exit(0);
}

echo "📊 USERS WITH FAILED ATTEMPTS:\n";
echo str_repeat("-", 80) . "\n";

while ($row = $result->fetch_assoc()) {
    $email = $row['email'];
    $attempts = (int)$row['failed_login_attempts'];
    $lastAttempt = $row['last_failed_attempt'];
    $userId = $row['user_id'];
    
    echo "👤 User: $email (ID: $userId)\n";
    echo "   Attempts: $attempts\n";
    echo "   Last Attempt: " . ($lastAttempt ?: 'Never') . "\n";
    
    if ($lastAttempt) {
        $timeSince = time() - strtotime($lastAttempt);
        echo "   Time Since: " . formatTime($timeSince) . "\n";
        echo "   Decay Cycles: " . floor($timeSince / 10) . "\n";
        echo "   Expected After Decay: " . max(0, $attempts - floor($timeSince / 10)) . "\n";
        echo "   🔄  Decay reduces attempts by 1 every 10 seconds\n";
    }
    
    // Check rate limiting status
    $rateLimitCheck = check_rate_limit($email);
    if ($rateLimitCheck['blocked']) {
        $remainingMinutes = get_remaining_lockout_minutes($rateLimitCheck['lockout_until']);
        echo "   Status: 🔴 LOCKED OUT ($remainingMinutes minutes remaining)\n";
    } else {
        echo "   Status: 🟢 NOT LOCKED OUT\n";
    }
    
    echo "\n";
}

$stmt->close();
$conn->close();

// Show recent log entries if available
$logFile = __DIR__ . '/attempts.log';
if (file_exists($logFile)) {
    echo "📝 RECENT ACTIVITY:\n";
    echo str_repeat("-", 80) . "\n";
    
    $logContent = file_get_contents($logFile);
    $logLines = explode("\n", $logContent);
    $logLines = array_filter($logLines);
    $recentLines = array_slice($logLines, -10);
    
    foreach ($recentLines as $line) {
        if (trim($line)) {
            echo $line . "\n";
        }
    }
    
    echo "\n";
}

echo "💡 COMMANDS:\n";
echo "  php api/utility/monitor_user_attempts.php [email]  - Monitor specific user\n";
echo "  php api/utility/attempt_logger.php view           - View all logs\n";
echo "  php api/utility/reset_user_account_lockouts.php   - Reset all lockouts\n";
echo "  php api/utility/rate_limit_dashboard.php          - Show this dashboard\n";

/**
 * Format seconds into human-readable time
 */
function formatTime($seconds) {
    if ($seconds < 60) {
        return "$seconds seconds";
    } elseif ($seconds < 3600) {
        $minutes = floor($seconds / 60);
        $remainingSeconds = $seconds % 60;
        return "$minutes minutes, $remainingSeconds seconds";
    } else {
        $hours = floor($seconds / 3600);
        $minutes = floor(($seconds % 3600) / 60);
        return "$hours hours, $minutes minutes";
    }
}
?>
