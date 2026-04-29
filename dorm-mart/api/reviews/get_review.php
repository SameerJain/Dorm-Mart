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

    // Get the user's review for this product
    $stmt = $conn->prepare(
        'SELECT pr.review_id, pr.product_id, pr.buyer_user_id, pr.seller_user_id, 
                pr.rating, pr.product_rating, pr.review_text, pr.image1_url, pr.image2_url, pr.image3_url,
                pr.created_at, pr.updated_at,
                ua.first_name, ua.last_name, ua.email
         FROM product_reviews pr
         LEFT JOIN user_accounts ua ON pr.buyer_user_id = ua.user_id
         WHERE pr.buyer_user_id = ? AND pr.product_id = ?
         LIMIT 1'
    );
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare review lookup');
    }
    $stmt->bind_param('ii', $userId, $productId);
    $stmt->execute();
    $result = $stmt->get_result();
    $review = $result ? $result->fetch_assoc() : null;
    $stmt->close();
    $conn->close();

    if (!$review) {
        json_response([
            'success' => true,
            'has_review' => false,
            'review' => null
        ]);
    }

    // XSS PROTECTION: Escape user-generated content before returning in JSON
    $buyerName = trim(($review['first_name'] ?? '') . ' ' . ($review['last_name'] ?? ''));
    $reviewData = [
        'review_id' => (int)$review['review_id'],
        'product_id' => (int)$review['product_id'],
        'buyer_user_id' => (int)$review['buyer_user_id'],
        'seller_user_id' => (int)$review['seller_user_id'],
        'rating' => (float)$review['rating'],
        'product_rating' => isset($review['product_rating']) ? (float)$review['product_rating'] : null,
        'review_text' => $review['review_text'],
        'image1_url' => $review['image1_url'] ?? null,
        'image2_url' => $review['image2_url'] ?? null,
        'image3_url' => $review['image3_url'] ?? null,
        'created_at' => $review['created_at'],
        'updated_at' => $review['updated_at'],
        'buyer_name' => $buyerName,
        'buyer_email' => $review['email'] ?? ''
    ];

    json_response([
        'success' => true,
        'has_review' => true,
        'review' => $reviewData
    ]);

} catch (Throwable $e) {
    error_log('get_review.php error: ' . $e->getMessage());
    json_response(['success' => false, 'error' => 'Internal server error'], 500);
}
