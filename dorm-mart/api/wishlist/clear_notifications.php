<?php
declare(strict_types=1);
require_once __DIR__ . '/../helpers/api_bootstrap.php';
require_once __DIR__ . '/../helpers/request.php';
init_json_endpoint('POST');
require __DIR__ . '/../auth/auth_handle.php';
require __DIR__ . '/../database/db_connect.php';
try {
    $userId = require_login();
    $input = json_request_body();
    require_csrf_token($input['csrf_token'] ?? null);
    $stmt = db()->prepare('DELETE FROM notifications WHERE recipient_user_id = ? AND available_at <= NOW()');
    if (!$stmt) throw new RuntimeException('Failed to prepare clear');
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $count = $stmt->affected_rows;
    $stmt->close();
    json_response(['success' => true, 'rows_affected' => $count]);
} catch (Throwable $e) {
    error_log('clear notifications error: ' . $e->getMessage());
    json_response(['success' => false, 'error' => 'Internal server error'], 500);
}
