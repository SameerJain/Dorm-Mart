<?php
declare(strict_types=1);

require_once __DIR__ . '/../helpers/api_bootstrap.php';
require_once __DIR__ . '/../helpers/request.php';

init_json_endpoint('POST');

require_once __DIR__ . '/../auth/auth_handle.php';
require_once __DIR__ . '/../database/db_connect.php';
require_once __DIR__ . '/../helpers/recommendations.php';

try {
    $userId = require_login();
    
    $conn = db();
    $conn->set_charset('utf8mb4');

    $input = json_request_body();
    
    require_csrf_token($input['csrf_token'] ?? null);
    
    $productId = require_product_id($input);

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

    recommendation_record_behavior($conn, $userId, $productId, 'wishlist_remove');
    // (The legacy wishlist_notification counter is no longer read anywhere;
    // seller alerts live in the notifications table since migration 010.)

    json_response(['success' => true, 'product_id' => $productId]);
} catch (Throwable $e) {
    api_fail($e, 'remove_from_wishlist');
}
