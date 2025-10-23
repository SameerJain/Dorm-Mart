<?php
/**
 * User Rate Limiting Monitor
 * 
 * This script allows you to monitor user login attempts, decay events, and rate limiting status.
 * 
 * USAGE:
 * php api/utility/monitor_user_attempts.php [email]
 * 
 * Examples:
 * php api/utility/monitor_user_attempts.php sameerja@buffalo.edu
 * php api/utility/monitor_user_attempts.php testuser@buffalo.edu
 */

require_once __DIR__ . '/../database/db_connect.php';
require_once __DIR__ . '/../security/security.php';

// Get email from command line argument
$email = $argv[1] ?? '';

if (empty($email)) {
    echo "Usage: php api/utility/monitor_user_attempts.php [email]\n";
    echo "Example: php api/utility/monitor_user_attempts.php sameerja@buffalo.edu\n";
    exit(1);
}

// Validate email format
if (!filter_var($email, FILTER_VALIDATE_EMAIL) || !preg_match('/@buffalo\.edu$/', $email)) {
    echo "Error: Email must be a valid @buffalo.edu address\n";
    exit(1);
}

echo "=== USER RATE LIMITING MONITOR ===\n";
echo "Email: $email\n";
echo "Time: " . date('Y-m-d H:i:s') . "\n";
echo str_repeat("=", 50) . "\n\n";

// Get current user status
$conn = db();
$stmt = $conn->prepare('SELECT user_id, failed_login_attempts, last_failed_attempt FROM user_accounts WHERE email = ?');
$stmt->bind_param('s', $email);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows === 0) {
    echo "❌ User not found in database\n";
    $stmt->close();
    $conn->close();
    exit(1);
}

$row = $result->fetch_assoc();
$stmt->close();
$conn->close();

$attempts = (int)$row['failed_login_attempts'];
$lastAttempt = $row['last_failed_attempt'];
$userId = $row['user_id'];

echo "📊 CURRENT STATUS:\n";
echo "  User ID: $userId\n";
echo "  Failed Attempts: $attempts\n";
echo "  Last Attempt: " . ($lastAttempt ?: 'Never') . "\n";

if ($lastAttempt) {
    $timeSince = time() - strtotime($lastAttempt);
    echo "  Time Since Last Attempt: " . formatTime($timeSince) . "\n";
    echo "  Decay Cycles (every 10s): " . floor($timeSince / 10) . "\n";
    echo "  Expected Attempts After Decay: " . max(0, $attempts - floor($timeSince / 10)) . "\n";
    echo "  🔄  Decay reduces attempts by 1 every 10 seconds\n";
}

echo "\n";

// Check rate limiting status
echo "🔒 RATE LIMITING STATUS:\n";
$rateLimitCheck = check_rate_limit($email);
if ($rateLimitCheck['blocked']) {
    $remainingMinutes = get_remaining_lockout_minutes($rateLimitCheck['lockout_until']);
    echo "  Status: 🔴 LOCKED OUT\n";
    echo "  Remaining Time: $remainingMinutes minutes\n";
    echo "  Lockout Until: " . $rateLimitCheck['lockout_until'] . "\n";
} else {
    echo "  Status: 🟢 NOT LOCKED OUT\n";
    echo "  Current Attempts: " . $rateLimitCheck['attempts'] . "\n";
}

echo "\n";

// Show decay simulation
if ($attempts > 0 && $lastAttempt) {
    echo "⏰ DECAY SIMULATION:\n";
    $currentTime = time();
    $lastAttemptTime = strtotime($lastAttempt);
    $timeSince = $currentTime - $lastAttemptTime;
    
    echo "  Current Time: " . date('Y-m-d H:i:s', $currentTime) . "\n";
    echo "  Last Attempt: " . date('Y-m-d H:i:s', $lastAttemptTime) . "\n";
    echo "  Time Elapsed: " . formatTime($timeSince) . "\n";
    
    $decayCycles = floor($timeSince / 10);
    $expectedAttempts = max(0, $attempts - $decayCycles);
    
    echo "  Decay Cycles: $decayCycles (every 10 seconds)\n";
    echo "  Original Attempts: $attempts\n";
    echo "  Expected After Decay: $expectedAttempts\n";
    
    if ($expectedAttempts < $attempts) {
        echo "  🎯 DECAY WOULD REDUCE ATTEMPTS BY: " . ($attempts - $expectedAttempts) . "\n";
    }
    
    // Show when decay would complete
    if ($attempts > 0) {
        $secondsToComplete = ($attempts * 10) - $timeSince;
        if ($secondsToComplete > 0) {
            echo "  ⏳ Time Until All Decay: " . formatTime($secondsToComplete) . "\n";
        } else {
            echo "  ✅ All decay would be complete!\n";
        }
    }
}

echo "\n";

// Show lockout expiry
if ($attempts >= 5 && $lastAttempt) {
    $lockoutExpiry = strtotime($lastAttempt) + (3 * 60); // 3 minutes
    $currentTime = time();
    $remainingLockout = $lockoutExpiry - $currentTime;
    
    echo "🚫 LOCKOUT STATUS:\n";
    echo "  Lockout Started: " . date('Y-m-d H:i:s', strtotime($lastAttempt)) . "\n";
    echo "  Lockout Expires: " . date('Y-m-d H:i:s', $lockoutExpiry) . "\n";
    
    if ($remainingLockout > 0) {
        echo "  Remaining Lockout: " . formatTime($remainingLockout) . "\n";
    } else {
        echo "  ✅ Lockout has expired!\n";
    }
}

echo "\n" . str_repeat("=", 50) . "\n";
echo "💡 TIP: Run this script again to see updated status after decay\n";

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
