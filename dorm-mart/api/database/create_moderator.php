<?php

declare(strict_types=1);

if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    exit("Forbidden\n");
}

if ($argc < 3) {
    fwrite(STDERR, "Usage: php api/database/create_moderator.php <email> <password> [first-name] [last-name]\n");
    exit(1);
}

$email = strtolower(trim((string)$argv[1]));
$password = (string)$argv[2];
$firstName = trim((string)($argv[3] ?? 'Dorm Mart'));
$lastName = trim((string)($argv[4] ?? 'Moderator'));

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    fwrite(STDERR, "Enter a valid email address.\n");
    exit(1);
}
if (strlen($password) < 12 || strlen($password) > 64) {
    fwrite(STDERR, "Moderator passwords must contain between 12 and 64 characters.\n");
    exit(1);
}

require_once __DIR__ . '/db_connect.php';

try {
    $conn = db();
    $hash = password_hash($password, PASSWORD_BCRYPT);
    $gradMonth = (int)date('n');
    $gradYear = (int)date('Y') + 4;

    $stmt = $conn->prepare('SELECT user_id FROM user_accounts WHERE email = ? LIMIT 1');
    $stmt->bind_param('s', $email);
    $stmt->execute();
    $existing = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if ($existing) {
        $stmt = $conn->prepare(
            "UPDATE user_accounts
                SET role = 'moderator', is_banned = 0, banned_at = NULL, ban_reason = NULL,
                    is_protected = 1, hash_pass = ?, hash_auth = NULL,
                    reset_token_hash = NULL, reset_token_expires = NULL,
                    last_reset_request = NULL, auth_version = auth_version + 1
              WHERE user_id = ?"
        );
        $userId = (int)$existing['user_id'];
        $stmt->bind_param('si', $hash, $userId);
    } else {
        $stmt = $conn->prepare(
            "INSERT INTO user_accounts
                (first_name, last_name, grad_month, grad_year, email, promotional, hash_pass,
                 hash_auth, seller, theme, role, is_protected)
             VALUES (?, ?, ?, ?, ?, 0, ?, NULL, 0, 0, 'moderator', 1)"
        );
        $stmt->bind_param('ssiiss', $firstName, $lastName, $gradMonth, $gradYear, $email, $hash);
    }

    $stmt->execute();
    if (!$existing) $userId = (int)$conn->insert_id;
    $stmt->close();

    echo json_encode(['success' => true, 'user_id' => $userId, 'email' => $email]) . PHP_EOL;
} catch (Throwable $e) {
    fwrite(STDERR, "Unable to create moderator: " . $e->getMessage() . PHP_EOL);
    exit(1);
}
