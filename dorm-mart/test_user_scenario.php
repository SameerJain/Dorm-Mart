<?php
/**
 * Test the exact scenario the user described
 */

require_once __DIR__ . '/api/database/db_connect.php';
require_once __DIR__ . '/api/security/security.php';

$email = 'testuser@buffalo.edu';

echo "=== TESTING USER SCENARIO ===\n";
echo "Email: $email\n\n";

// Clear everything first
$conn = db();
$stmt = $conn->prepare('UPDATE user_accounts SET failed_login_attempts = 0, last_failed_attempt = NULL, lockout_until = NULL WHERE email = ?');
$stmt->bind_param('s', $email);
$stmt->execute();
$stmt->close();
$conn->close();

// Step 1: Make 5 attempts to trigger lockout
echo "🔄 Step 1: Making 5 rapid attempts...\n";
for ($i = 1; $i <= 5; $i++) {
    record_failed_attempt($email);
    $rateLimitCheck = check_rate_limit($email);
    echo "  Attempt $i: " . $rateLimitCheck['attempts'] . " attempts, blocked: " . ($rateLimitCheck['blocked'] ? 'YES' : 'NO');
    if ($rateLimitCheck['blocked']) {
        echo " (Lockout until: " . $rateLimitCheck['lockout_until'] . ")";
    }
    echo "\n";
    usleep(100000); // 0.1 second
}

echo "\n⏰ Step 2: Waiting 3 minutes (180 seconds)...\n";
sleep(180); // Wait exactly 3 minutes

echo "After 3 minutes, checking lockout status...\n";
$rateLimitCheck = check_rate_limit($email);
echo "  Attempts: " . $rateLimitCheck['attempts'] . "\n";
echo "  Blocked: " . ($rateLimitCheck['blocked'] ? 'YES' : 'NO') . "\n";
echo "  Lockout Until: " . ($rateLimitCheck['lockout_until'] ?? 'NULL') . "\n";

if ($rateLimitCheck['blocked']) {
    echo "\n❌ PROBLEM: Still blocked after 3 minutes!\n";
} else {
    echo "\n✅ SUCCESS: Lockout expired after 3 minutes!\n";
}

echo "\n🔄 Step 3: Trying a failed login after lockout should have expired...\n";
record_failed_attempt($email);
$rateLimitCheck = check_rate_limit($email);
echo "  After failed login: " . $rateLimitCheck['attempts'] . " attempts, blocked: " . ($rateLimitCheck['blocked'] ? 'YES' : 'NO') . "\n";

if ($rateLimitCheck['blocked']) {
    echo "❌ PROBLEM: Still blocked after lockout should have expired!\n";
} else {
    echo "✅ SUCCESS: Can attempt login after lockout expired!\n";
}

echo "\n=== TEST COMPLETE ===\n";
?>
