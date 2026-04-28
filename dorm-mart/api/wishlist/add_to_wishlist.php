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
    
    $token = $input['csrf_token'] ?? null;
    if ($token !== null && !validate_csrf_token($token)) {
        json_response(['success' => false, 'error' => 'CSRF token validation failed'], 403);
    }
    
    $productId = request_int($input, 'product_id');
    if ($productId <= 0) {
        json_response(['success' => false, 'error' => 'Invalid product_id'], 400);
    }

    $checkStmt = $conn->prepare('SELECT product_id FROM INVENTORY WHERE product_id = ?');
    if (!$checkStmt) {
        throw new RuntimeException('Failed to prepare product check');
    }
    $checkStmt->bind_param('i', $productId);
    $checkStmt->execute();
    $result = $checkStmt->get_result();
    if ($result->num_rows === 0) {
        json_response(['success' => false, 'error' => 'Product not found'], 404);
    }
    $checkStmt->close();

    $checkWishlistStmt = $conn->prepare('SELECT wishlist_id FROM wishlist WHERE user_id = ? AND product_id = ?');
    if (!$checkWishlistStmt) {
        throw new RuntimeException('Failed to prepare wishlist check');
    }
    $checkWishlistStmt->bind_param('ii', $userId, $productId);
    $checkWishlistStmt->execute();
    $wishlistResult = $checkWishlistStmt->get_result();
    if ($wishlistResult->num_rows > 0) {
        json_response(['success' => false, 'error' => 'Product already in wishlist'], 400);
    }
    $checkWishlistStmt->close();

    $stmt = $conn->prepare('INSERT INTO wishlist (user_id, product_id) VALUES (?, ?)');
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare insert');
    }
    $stmt->bind_param('ii', $userId, $productId);
    $stmt->execute();
    $wishlistId = $conn->insert_id;
    $stmt->close();

    $updateStmt = $conn->prepare('UPDATE INVENTORY SET wishlisted = wishlisted + 1 WHERE product_id = ?');
    if ($updateStmt) {
        $updateStmt->bind_param('i', $productId);
        $updateStmt->execute();
        $updateStmt->close();
    }

    $wnStmt = $conn->prepare('UPDATE wishlist_notification SET unread_count = unread_count + 1 WHERE product_id = ?');
    if ($wnStmt) {
        $wnStmt->bind_param('i', $productId);
        $wnStmt->execute();
        $wnStmt->close();
    }

    json_response(['success' => true, 'wishlist_id' => $wishlistId, 'product_id' => $productId]);
} catch (Throwable $e) {
    error_log('add_to_wishlist error: ' . $e->getMessage());
    json_response(['success' => false, 'error' => 'Internal server error'], 500);
}
