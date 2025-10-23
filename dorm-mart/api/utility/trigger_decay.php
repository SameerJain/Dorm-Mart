<?php
/**
 * Manual Decay Trigger
 * 
 * This script manually triggers the decay system for a specific user.
 * Useful for testing the decay system without waiting.
 * 
 * USAGE:
 * php api/utility/trigger_decay.php [email]
 * 
 * Example:
 * php api/utility/trigger_decay.php sameerja@buffalo.edu
 */

require_once __DIR__ . '/../database/db_connect.php';
require_once __DIR__ . '/../security/security.php';

// Get email from command line argument
$email = $argv[1] ?? '';

if (empty($email)) {
    echo "Usage: php api/utility/trigger_decay.php [email]\n";
    echo "Example: php api/utility/trigger_decay.php sameerja@buffalo.edu\n";
    exit(1);
}

// Validate email format
if (!filter_var($email, FILTER_VALIDATE_EMAIL) || !preg_match('/@buffalo\.edu$/', $email)) {
    echo "Error: Email must be a valid @buffalo.edu address\n";
    exit(1);
}

echo "=== MANUAL DECAY TRIGGER ===\n";
echo "Email: $email\n";
echo "Time: " . date('Y-m-d H:i:s') . "\n";
echo str_repeat("=", 50) . "\n\n";

// Get current user status
$conn = db();
$stmt = $conn->prepare('SELECT failed_login_attempts, last_failed_attempt FROM user_accounts WHERE email = ?');
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

echo "📊 BEFORE DECAY:\n";
echo "  Attempts: $attempts\n";
echo "  Last Attempt: " . ($lastAttempt ?: 'Never') . "\n";

if ($attempts === 0) {
    echo "✅ No attempts to decay\n";
    exit(0);
}

if (!$lastAttempt) {
    echo "❌ No last attempt timestamp to calculate decay\n";
    exit(1);
}

// Calculate decay
$currentTime = time();
$lastAttemptTime = strtotime($lastAttempt);
$timeSinceLastAttempt = $currentTime - $lastAttemptTime;
$decayCycles = floor($timeSinceLastAttempt / 10);
$newAttempts = max(0, $attempts - $decayCycles);

echo "\n⏰ DECAY CALCULATION:\n";
echo "  Current Time: " . date('Y-m-d H:i:s', $currentTime) . "\n";
echo "  Last Attempt: " . date('Y-m-d H:i:s', $lastAttemptTime) . "\n";
echo "  Time Since: " . $timeSinceLastAttempt . " seconds\n";
    echo "  Decay Cycles: $decayCycles (every 10 seconds)\n";
    echo "  Original Attempts: $attempts\n";
    echo "  New Attempts: $newAttempts\n";
    echo "  (New system: decay by 1 every 10+ seconds)\n";

if ($newAttempts !== $attempts) {
    // Apply the decay
    $conn = db();
    $stmt = $conn->prepare('UPDATE user_accounts SET failed_login_attempts = ? WHERE email = ?');
    $stmt->bind_param('is', $newAttempts, $email);
    $stmt->execute();
    $stmt->close();
    $conn->close();
    
    echo "\n✅ DECAY APPLIED:\n";
    echo "  Attempts: $attempts → $newAttempts\n";
    echo "  Reduced: " . ($attempts - $newAttempts) . " attempts\n";
    
    // Log the decay event
    error_log("MANUAL DECAY: $email attempts REDUCED from $attempts to $newAttempts (decay cycles: $decayCycles)");
} else {
    echo "\n⏳ NO DECAY NEEDED:\n";
    echo "  Not enough time has passed for decay\n";
    echo "  Need " . (10 - ($timeSinceLastAttempt % 10)) . " more seconds for next decay\n";
}

echo "\n" . str_repeat("=", 50) . "\n";
echo "💡 TIP: Use 'php api/utility/monitor_user_attempts.php $email' to see current status\n";
?>

