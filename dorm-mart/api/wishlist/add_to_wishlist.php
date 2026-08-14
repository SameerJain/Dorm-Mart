<?php
declare(strict_types=1);

require_once __DIR__ . '/../helpers/api_bootstrap.php';
require_once __DIR__ . '/../helpers/request.php';

init_json_endpoint('POST');

require __DIR__ . '/../auth/auth_handle.php';
require __DIR__ . '/../database/db_connect.php';
require_once __DIR__ . '/../helpers/notifications.php';

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

    $checkStmt = $conn->prepare('SELECT product_id, seller_id, title, photos FROM INVENTORY WHERE product_id = ?');
    if (!$checkStmt) {
        throw new RuntimeException('Failed to prepare product check');
    }
    $checkStmt->bind_param('i', $productId);
    $checkStmt->execute();
    $result = $checkStmt->get_result();
    if ($result->num_rows === 0) {
        json_response(['success' => false, 'error' => 'Product not found'], 404);
    }
    $product = $result->fetch_assoc();
    $checkStmt->close();
    if ((int)$product['seller_id'] === $userId) {
        json_response(['success' => false, 'error' => 'Cannot add your own listing to wishlist'], 400);
    }

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

    $conn->begin_transaction();
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

    notification_insert($conn, [
        'recipient_user_id' => (int)$product['seller_id'], 'type' => 'wishlist_added',
        'product_id' => $productId, 'title' => (string)$product['title'],
        'message' => 'A buyer saved this listing to their wishlist.',
        'image_url' => notification_first_image($product['photos'] ?? null),
        'destination' => '/app/viewProduct/' . $productId,
        'idempotency_key' => 'wishlist-added-' . $wishlistId,
    ]);
    $conn->commit();

    json_response(['success' => true, 'wishlist_id' => $wishlistId, 'product_id' => $productId]);
} catch (Throwable $e) {
    if (isset($conn) && $conn instanceof mysqli) { try { $conn->rollback(); } catch (Throwable $_) {} }
    error_log('add_to_wishlist error: ' . $e->getMessage());
    json_response(['success' => false, 'error' => 'Internal server error'], 500);
}
