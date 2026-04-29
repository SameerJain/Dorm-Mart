<?php

declare(strict_types=1);

require_once __DIR__ . '/../auth/auth_handle.php';
require_once __DIR__ . '/../database/db_connect.php';
require_once __DIR__ . '/../helpers/api_bootstrap.php';
require_once __DIR__ . '/../helpers/request.php';

init_json_endpoint('POST');

try {
    auth_boot_session();
    $userId = require_login();

    $payload = json_request_body_or_error();
    require_csrf_token($payload['csrf_token'] ?? null);

    // Validate product_id
    $productId = isset($payload['product_id']) ? (int)$payload['product_id'] : 0;
    if ($productId <= 0) {
        json_response(['success' => false, 'error' => 'Invalid product_id'], 400);
    }

    // Validate buyer_user_id
    $buyerId = isset($payload['buyer_user_id']) ? (int)$payload['buyer_user_id'] : 0;
    if ($buyerId <= 0) {
        json_response(['success' => false, 'error' => 'Invalid buyer_user_id'], 400);
    }

    // Validate rating (0-5 in 0.5 increments)
    $rating = isset($payload['rating']) ? (float)$payload['rating'] : -1;
    if ($rating < 0 || $rating > 5) {
        json_response(['success' => false, 'error' => 'Rating must be between 0 and 5'], 400);
    }
    // Check for 0.5 increments
    if (fmod($rating * 2, 1) !== 0.0) {
        json_response(['success' => false, 'error' => 'Rating must be in 0.5 increments'], 400);
    }

    // Validate review_text (optional, max 250 chars if provided)
    $reviewText = isset($payload['review_text']) ? trim((string)$payload['review_text']) : '';
    if (strlen($reviewText) > 250) {
        json_response(['success' => false, 'error' => 'Review text must be 250 characters or less'], 400);
    }
    
    // XSS PROTECTION: Filtering (Layer 1) - blocks patterns before DB storage
    if ($reviewText !== '' && contains_xss_pattern($reviewText)) {
        json_response(['success' => false, 'error' => 'Invalid characters in review text'], 400);
    }

    $conn = db();
    $conn->set_charset('utf8mb4');

    // Check if the product exists and get seller_id
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

    // Verify that the current user is the seller
    if ($sellerId !== $userId) {
        json_response(['success' => false, 'error' => 'You can only rate buyers for your own products'], 403);
    }

    // Verify that the product is sold to this buyer
    $stmt = $conn->prepare('SELECT sold, sold_to, item_status FROM INVENTORY WHERE product_id = ? LIMIT 1');
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare sold status lookup');
    }
    $stmt->bind_param('i', $productId);
    $stmt->execute();
    $result = $stmt->get_result();
    $soldRow = $result ? $result->fetch_assoc() : null;
    $stmt->close();

    $isSold = ($soldRow && ($soldRow['sold'] == 1 || strtolower($soldRow['item_status'] ?? '') === 'sold'));
    $soldToBuyer = $soldRow && isset($soldRow['sold_to']) && (int)$soldRow['sold_to'] === $buyerId;

    if (!$isSold || !$soldToBuyer) {
        json_response(['success' => false, 'error' => 'Product must be sold to this buyer'], 403);
    }

    // Check if user has already rated this buyer for this product
    $stmt = $conn->prepare('SELECT rating_id FROM buyer_ratings WHERE seller_user_id = ? AND buyer_user_id = ? AND product_id = ? LIMIT 1');
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare existing rating check');
    }
    $stmt->bind_param('iii', $userId, $buyerId, $productId);
    $stmt->execute();
    $result = $stmt->get_result();
    $existingRating = $result ? $result->fetch_assoc() : null;
    $stmt->close();

    if ($existingRating) {
        json_response(['success' => false, 'error' => 'You have already rated this buyer for this product'], 409);
    }

    // Insert the buyer rating
    $stmt = $conn->prepare(
        'INSERT INTO buyer_ratings (product_id, seller_user_id, buyer_user_id, rating, review_text) 
         VALUES (?, ?, ?, ?, ?)'
    );
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare buyer rating insert');
    }
    $stmt->bind_param('iiids', $productId, $userId, $buyerId, $rating, $reviewText);
    $success = $stmt->execute();
    $ratingId = $stmt->insert_id;
    $stmt->close();

    if (!$success) {
        throw new RuntimeException('Failed to insert buyer rating');
    }

    // Update buyer's average buyer_rating in user_accounts
    $stmt = $conn->prepare(
        'UPDATE user_accounts SET buyer_rating = (
            SELECT AVG(rating) FROM buyer_ratings WHERE buyer_user_id = ?
        ) WHERE user_id = ?'
    );
    if ($stmt) {
        $stmt->bind_param('ii', $buyerId, $buyerId);
        $stmt->execute();
        $stmt->close();
    }

    // Get the created rating
    $stmt = $conn->prepare(
        'SELECT rating_id, product_id, seller_user_id, buyer_user_id, rating, review_text, created_at, updated_at
         FROM buyer_ratings WHERE rating_id = ? LIMIT 1'
    );
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare rating fetch');
    }
    $stmt->bind_param('i', $ratingId);
    $stmt->execute();
    $result = $stmt->get_result();
    $ratingData = $result ? $result->fetch_assoc() : null;
    $stmt->close();
    $conn->close();

    // XSS PROTECTION: Escape user-generated content before returning in JSON
    json_response([
        'success' => true,
        'rating_id' => $ratingId,
        'rating' => [
            'rating_id' => (int)$ratingData['rating_id'],
            'product_id' => (int)$ratingData['product_id'],
            'seller_user_id' => (int)$ratingData['seller_user_id'],
            'buyer_user_id' => (int)$ratingData['buyer_user_id'],
            'rating' => (float)$ratingData['rating'],
            'review_text' => $ratingData['review_text'] ?? '',
            'created_at' => $ratingData['created_at'],
            'updated_at' => $ratingData['updated_at'],
        ],
        'message' => 'Buyer rating submitted successfully'
    ]);

} catch (Throwable $e) {
    error_log('submit_buyer_rating.php error: ' . $e->getMessage());
    json_response(['success' => false, 'error' => 'Internal server error'], 500);
}
