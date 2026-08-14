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
    $id = request_int($input, 'notification_id');
    if ($id <= 0) json_response(['success' => false, 'error' => 'Invalid notification_id'], 400);
    $stmt = db()->prepare('DELETE FROM notifications WHERE notification_id = ? AND recipient_user_id = ?');
    if (!$stmt) throw new RuntimeException('Failed to prepare delete');
    $stmt->bind_param('ii', $id, $userId);
    $stmt->execute();
    if ($stmt->affected_rows !== 1) json_response(['success' => false, 'error' => 'Notification not found'], 404);
    $stmt->close();
    json_response(['success' => true, 'notification_id' => $id]);
} catch (Throwable $e) {
    error_log('delete notification error: ' . $e->getMessage());
    json_response(['success' => false, 'error' => 'Internal server error'], 500);
}
