<?php
declare(strict_types=1);

require_once __DIR__ . '/../helpers/api_bootstrap.php';
require_once __DIR__ . '/../auth/auth_handle.php';
require_once __DIR__ . '/../database/db_connect.php';
require_once __DIR__ . '/profile_helpers.php';

init_json_endpoint('GET');

try {
    require_login();

    $requestedId = isset($_GET['user_id']) ? (int)$_GET['user_id'] : 0;
    if ($requestedId <= 0) {
        json_response(['success' => false, 'error' => 'Invalid user_id'], 400);
    }

    $conn = db();
    $conn->set_charset('utf8mb4');

    $stmt = $conn->prepare('SELECT email FROM user_accounts WHERE user_id = ? LIMIT 1');
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare username lookup');
    }
    $stmt->bind_param('i', $requestedId);
    $stmt->execute();
    $result = $stmt->get_result();
    $row = $result ? $result->fetch_assoc() : null;
    $stmt->close();
    $conn->close();

    if (!$row || empty($row['email'])) {
        json_response(['success' => false, 'error' => 'User not found'], 404);
    }

    $username = derive_username((string)$row['email']);
    json_response([
        'success' => true,
        'user_id' => $requestedId,
        'username' => $username,
    ]);
} catch (Throwable $e) {
    error_log('get_username.php error: ' . $e->getMessage());
    json_response(['success' => false, 'error' => 'Internal server error'], 500);
}
