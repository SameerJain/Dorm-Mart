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
    
    $productId = request_int($input, 'product_id');
    if ($productId <= 0) {
        json_response(['success' => false, 'error' => 'Invalid product_id'], 400);
    }

    $stmt = $conn->prepare('DELETE FROM wishlist WHERE user_id = ? AND product_id = ?');
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare delete');
    }
    $stmt->bind_param('ii', $userId, $productId);
    $stmt->execute();

    if ($stmt->affected_rows < 1) {
        json_response(['success' => false, 'error' => 'Product not in wishlist'], 404);
    }
    $stmt->close();

    $updateStmt = $conn->prepare('UPDATE INVENTORY SET wishlisted = GREATEST(wishlisted - 1, 0) WHERE product_id = ?');
    if ($updateStmt) {
        $updateStmt->bind_param('i', $productId);
        $updateStmt->execute();
        $updateStmt->close();
    }

    $notifStmt = $conn->prepare(
        'UPDATE wishlist_notification
        SET unread_count = CASE
            WHEN unread_count > 0 THEN unread_count - 1
            ELSE 0
        END
        WHERE product_id = ?'
    );
    if ($notifStmt) {
        $notifStmt->bind_param('i', $productId);
        $notifStmt->execute();
        $notifStmt->close();
    }

    json_response(['success' => true, 'product_id' => $productId]);
} catch (Throwable $e) {
    error_log('remove_from_wishlist error: ' . $e->getMessage());
    json_response(['success' => false, 'error' => 'Internal server error'], 500);
}
