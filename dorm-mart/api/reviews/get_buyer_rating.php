<?php

declare(strict_types=1);

require_once __DIR__ . '/../helpers/api_bootstrap.php';
require_once __DIR__ . '/../auth/auth_handle.php';
require_once __DIR__ . '/../database/db_connect.php';

init_json_endpoint('GET');

try {
    auth_boot_session();
    $userId = require_login();

    // Validate product_id
    $productIdParam = trim((string)($_GET['product_id'] ?? ''));
    if (!ctype_digit($productIdParam)) {
        json_response(['success' => false, 'error' => 'Invalid product_id'], 400);
    }
    $productId = (int)$productIdParam;

    $conn = db();
    $conn->set_charset('utf8mb4');

    // Verify that the current user is the seller of this product
    $stmt = $conn->prepare('SELECT seller_id FROM INVENTORY WHERE product_id = ? LIMIT 1');
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare product lookup');
    }
    $stmt->bind_param('i', $productId);
    $stmt->execute();
    $result = $stmt->get_result();
    $productRow = $result ? $result->fetch_assoc() : null;
    $stmt->close();

    if (!$productRow) {
        json_response(['success' => false, 'error' => 'Product not found'], 404);
    }

    $sellerId = (int)$productRow['seller_id'];
    if ($sellerId !== $userId) {
        json_response(['success' => false, 'error' => 'You are not authorized to view buyer ratings for this product'], 403);
    }

    // Get the buyer rating for this product
    $stmt = $conn->prepare(
        'SELECT rating_id, product_id, seller_user_id, buyer_user_id, rating, review_text, created_at, updated_at
         FROM buyer_ratings 
         WHERE seller_user_id = ? AND product_id = ?
         LIMIT 1'
    );
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare buyer rating lookup');
    }
    $stmt->bind_param('ii', $userId, $productId);
    $stmt->execute();
    $result = $stmt->get_result();
    $rating = $result ? $result->fetch_assoc() : null;
    $stmt->close();
    $conn->close();

    if (!$rating) {
        json_response([
            'success' => true,
            'has_rating' => false,
            'rating' => null
        ]);
    }

    // XSS PROTECTION: Escape user-generated content before returning in JSON
    $ratingData = [
        'rating_id' => (int)$rating['rating_id'],
        'product_id' => (int)$rating['product_id'],
        'seller_user_id' => (int)$rating['seller_user_id'],
        'buyer_user_id' => (int)$rating['buyer_user_id'],
        'rating' => (float)$rating['rating'],
        'review_text' => $rating['review_text'] ?? '',
        'created_at' => $rating['created_at'],
        'updated_at' => $rating['updated_at']
    ];

    json_response([
        'success' => true,
        'has_rating' => true,
        'rating' => $ratingData
    ]);

} catch (Throwable $e) {
    error_log('get_buyer_rating.php error: ' . $e->getMessage());
    json_response(['success' => false, 'error' => 'Internal server error'], 500);
}
