<?php
declare(strict_types=1);

require_once __DIR__ . '/../helpers/api_bootstrap.php';
require_once __DIR__ . '/../helpers/request.php';

init_json_endpoint('POST');

require __DIR__ . '/../auth/auth_handle.php';
require __DIR__ . '/../database/db_connect.php';

try {
    $userId = require_login();

    $conn = db();
    $conn->set_charset('utf8mb4');

    $input = json_request_body();

    require_csrf_token($input['csrf_token'] ?? null);

    $notificationId = request_int($input, 'notification_id');
    if ($notificationId <= 0) {
        json_response(['success' => false, 'error' => 'Invalid notification_id'], 400);
    }

    // Reset unread_count to 0 for this seller + product
    $stmt = $conn->prepare(
        'UPDATE notifications SET is_read = 1
         WHERE recipient_user_id = ? AND notification_id = ?'
    );
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare update');
    }

    $stmt->bind_param('ii', $userId, $notificationId);
    $stmt->execute();
    $stmt->close();

    json_response([
        'success'    => true,
        'notification_id' => $notificationId,
    ]);
} catch (Throwable $e) {
    error_log('mark_item_read error: ' . $e->getMessage());
    json_response(['success' => false, 'error' => 'Internal server error'], 500);
}
