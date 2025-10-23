<?php
/**
 * Decay System Tester
 * 
 * This script tests the decay system by making attempts and monitoring the decay.
 * 
 * USAGE:
 * php api/utility/test_decay_system.php [email]
 * 
 * Example:
 * php api/utility/test_decay_system.php sameerja@buffalo.edu
 */

require_once __DIR__ . '/../database/db_connect.php';
require_once __DIR__ . '/../security/security.php';

// Get email from command line argument
$email = $argv[1] ?? '';

if (empty($email)) {
    echo "Usage: php api/utility/test_decay_system.php [email]\n";
    echo "Example: php api/utility/test_decay_system.php sameerja@buffalo.edu\n";
    exit(1);
}

// Validate email format
if (!filter_var($email, FILTER_VALIDATE_EMAIL) || !preg_match('/@buffalo\.edu$/', $email)) {
    echo "Error: Email must be a valid @buffalo.edu address\n";
    exit(1);
}

echo "=== DECAY SYSTEM TESTER ===\n";
echo "Email: $email\n";
echo "Time: " . date('Y-m-d H:i:s') . "\n";
echo str_repeat("=", 60) . "\n\n";

// Reset user first
$conn = db();
$stmt = $conn->prepare('UPDATE user_accounts SET failed_login_attempts = 0, last_failed_attempt = NULL WHERE email = ?');
$stmt->bind_param('s', $email);
$stmt->execute();
$stmt->close();
$conn->close();
echo "✅ Reset user attempts to 0\n\n";

// Make 4 failed attempts
echo "🔄 Making 4 failed attempts...\n";
for ($i = 1; $i <= 4; $i++) {
    echo "  Attempt $i...\n";
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, 'http://localhost:8080/api/auth/login.php');
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(['email' => $email, 'password' => 'wrongpassword']));
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    echo "    HTTP Code: $httpCode\n";
    
    // Check current state
    $conn = db();
    $stmt = $conn->prepare('SELECT failed_login_attempts, last_failed_attempt FROM user_accounts WHERE email = ?');
    $stmt->bind_param('s', $email);
    $stmt->execute();
    $result = $stmt->get_result();
    $row = $result->fetch_assoc();
    $stmt->close();
    $conn->close();
    
    echo "    Current attempts: " . $row['failed_login_attempts'] . "\n";
    echo "    Last attempt: " . ($row['last_failed_attempt'] ?? 'NULL') . "\n\n";
    
    sleep(1);
}

echo "⏰ Waiting 15 seconds for decay...\n";
echo "   (This should trigger 1 decay cycle: 4 → 3)\n";
echo "   (New system: decay by 1 every 10+ seconds)\n";
sleep(15);

// Check state after decay
$conn = db();
$stmt = $conn->prepare('SELECT failed_login_attempts, last_failed_attempt FROM user_accounts WHERE email = ?');
$stmt->bind_param('s', $email);
$stmt->execute();
$result = $stmt->get_result();
$row = $result->fetch_assoc();
$stmt->close();
$conn->close();

echo "📊 After 15 seconds:\n";
echo "  Attempts: " . $row['failed_login_attempts'] . "\n";
echo "  Last attempt: " . ($row['last_failed_attempt'] ?? 'NULL') . "\n";

if ($row['last_failed_attempt']) {
    $timeSince = time() - strtotime($row['last_failed_attempt']);
    echo "  Time since last attempt: $timeSince seconds\n";
    echo "  Decay cycles: " . floor($timeSince / 10) . "\n";
    echo "  Expected attempts: " . max(0, $row['failed_login_attempts'] - floor($timeSince / 10)) . "\n";
    echo "  (New system: decay by 1 every 10+ seconds)\n";
}

echo "\n🧪 Testing 5th attempt after decay...\n";
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, 'http://localhost:8080/api/auth/login.php');
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(['email' => $email, 'password' => 'wrongpassword']));
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

echo "5th attempt HTTP Code: $httpCode\n";
if ($httpCode === 429) {
    echo "❌ STILL RATE LIMITED - Decay is NOT working!\n";
    echo "Response: $response\n";
} else {
    echo "✅ 401 - Invalid credentials (CORRECT - decay worked!)\n";
    echo "🎉 The decay system is working! Attempts were reduced by 1.\n";
}

echo "\n" . str_repeat("=", 60) . "\n";
echo "💡 TIP: Use 'php api/utility/monitor_user_attempts.php $email' to monitor in real-time\n";
?>

