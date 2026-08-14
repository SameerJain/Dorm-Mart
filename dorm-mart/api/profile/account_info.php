<?php
declare(strict_types=1);

require_once __DIR__ . '/../helpers/api_bootstrap.php';
init_json_endpoint('GET');

require __DIR__ . '/../auth/auth_handle.php';
require __DIR__ . '/../database/db_connect.php';

try {
    $userId = require_login();
    $conn = db();
    $conn->set_charset('utf8mb4');

    $stmt = $conn->prepare(
        'SELECT first_name, last_name, email, grad_month, grad_year, join_date
         FROM user_accounts WHERE user_id = ? LIMIT 1'
    );
    if (!$stmt) throw new RuntimeException('Failed to prepare account lookup');
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (!$row) json_response(['success' => false, 'error' => 'Account not found'], 404);

    json_response([
        'success' => true,
        'account' => [
            'first_name' => (string)$row['first_name'],
            'last_name' => (string)$row['last_name'],
            'email' => (string)$row['email'],
            'grad_month' => (int)$row['grad_month'],
            'grad_year' => (int)$row['grad_year'],
            'join_date' => $row['join_date'],
        ],
    ]);
} catch (Throwable $e) {
    error_log('account_info error: ' . $e->getMessage());
    json_response(['success' => false, 'error' => 'Internal server error'], 500);
}
