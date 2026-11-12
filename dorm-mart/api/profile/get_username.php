<?php
declare(strict_types=1);

require_once __DIR__ . '/../helpers/api_bootstrap.php';
require_once __DIR__ . '/../auth/auth_handle.php';
require_once __DIR__ . '/../database/db_connect.php';
require_once __DIR__ . '/../helpers/request.php';
require_once __DIR__ . '/profile_helpers.php';

init_json_endpoint('GET');

try {
    $userId = require_login();

    $requestedId = request_int($_GET, 'user_id');
    if ($requestedId <= 0) {
        json_response(['success' => false, 'error' => 'Invalid user_id'], 400);
    }

    $conn = db();
    $conn->set_charset('utf8mb4');

    // A username is the local part of an email address, so an id only resolves
    // for yourself or someone you share a conversation with (the chat header).
    $stmt = $conn->prepare(
        'SELECT ua.email
           FROM user_accounts ua
          WHERE ua.user_id = ?
            AND (ua.user_id = ? OR EXISTS (
                SELECT 1 FROM conversations c
                 WHERE (c.user1_id = ua.user_id AND c.user2_id = ?)
                    OR (c.user2_id = ua.user_id AND c.user1_id = ?)))
          LIMIT 1'
    );
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare username lookup');
    }
    $stmt->bind_param('iiii', $requestedId, $userId, $userId, $userId);
    $stmt->execute();
    $result = $stmt->get_result();
    $row = $result ? $result->fetch_assoc() : null;
    $stmt->close();
    $conn->close();

    if (!$row || empty($row['email'])) {
        json_response(['success' => false, 'error' => 'User not found'], 404);
    }

    $username = inventory_username_from_email((string)$row['email']);
    json_response([
        'success' => true,
        'user_id' => $requestedId,
        'username' => $username,
    ]);
} catch (Throwable $e) {
    error_log('get_username.php error: ' . $e->getMessage());
    json_response(['success' => false, 'error' => 'Internal server error'], 500);
}
