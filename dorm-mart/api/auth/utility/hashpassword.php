<?php
// Usage: http://localhost/serve/dorm-mart/hash_password.php?password=YourPassword123

$password = $_GET['password'] ?? '';

if ($password === '') {
    echo "Usage: ?password=YourPassword123";
    exit;
}

$hash = password_hash($password, PASSWORD_DEFAULT);

echo "Password: " . htmlspecialchars($password) . "<br>";
echo "Hash: " . htmlspecialchars($hash) . "<br><br>";
echo "Copy this hash into your SQL INSERT statement.";
?>