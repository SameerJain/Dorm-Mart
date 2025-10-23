<?php
/**
 * Debug the lockout state in the database
 */

require_once __DIR__ . '/api/database/db_connect.php';

$email = 'testuser@buffalo.edu';

echo "=== DEBUGGING LOCKOUT STATE ===\n";
echo "Email: $email\n\n";

$conn = db();
$stmt = $conn->prepare('SELECT failed_login_attempts, last_failed_attempt, lockout_until FROM user_accounts WHERE email = ?');
$stmt->bind_param('s', $email);
$stmt->execute();
$result = $stmt->get_result();
$row = $result->fetch_assoc();
$stmt->close();
$conn->close();

echo "Current database state:\n";
echo "  Attempts: " . ($row['failed_login_attempts'] ?? 'NULL') . "\n";
echo "  Last Attempt: " . ($row['last_failed_attempt'] ?? 'NULL') . "\n";
echo "  Lockout Until: " . ($row['lockout_until'] ?? 'NULL') . "\n\n";

if ($row['lockout_until']) {
    $currentTime = time();
    $lockoutExpiry = strtotime($row['lockout_until']);
    $timeRemaining = $lockoutExpiry - $currentTime;
    
    echo "Lockout analysis:\n";
    echo "  Current Time: " . date('Y-m-d H:i:s', $currentTime) . "\n";
    echo "  Lockout Expiry: " . date('Y-m-d H:i:s', $lockoutExpiry) . "\n";
    echo "  Time Remaining: " . $timeRemaining . " seconds\n";
    echo "  Is Expired: " . ($timeRemaining <= 0 ? 'YES' : 'NO') . "\n";
}

echo "\n=== DEBUG COMPLETE ===\n";
?>
