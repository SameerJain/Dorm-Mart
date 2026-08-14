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

    // Reset unread_count to 0 for all products for this seller
    $stmt = $conn->prepare(
        'UPDATE notifications SET is_read = 1
         WHERE recipient_user_id = ? AND is_read = 0 AND available_at <= NOW()'
    );
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare update');
    }

    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $affected = $stmt->affected_rows;
    $stmt->close();

    json_response([
        'success'        => true,
        'rows_affected'  => $affected,
    ]);
} catch (Throwable $e) {
    error_log('mark_all_items_read error: ' . $e->getMessage());
    json_response(['success' => false, 'error' => 'Internal server error'], 500);
}
