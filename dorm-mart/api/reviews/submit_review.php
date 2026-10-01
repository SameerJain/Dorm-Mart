<?php

declare(strict_types=1);

require_once __DIR__ . '/../auth/auth_handle.php';
require_once __DIR__ . '/../database/db_connect.php';
require_once __DIR__ . '/../helpers/api_bootstrap.php';
require_once __DIR__ . '/../helpers/request.php';
require_once __DIR__ . '/../helpers/image_upload.php';
require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/../helpers/notifications.php';

init_json_endpoint('POST');

try {
    auth_boot_session();
    $userId = require_login();

    $payload = json_request_body_or_error();
    require_csrf_token($payload['csrf_token'] ?? null);

    $productId = require_product_id($payload);

    $rating = require_half_star_rating(
        $payload,
        'rating',
        'Seller rating must be between 0.5 and 5',
        'Seller rating must be in 0.5 increments'
    );

    $productRating = require_half_star_rating(
        $payload,
        'product_rating',
        'Product rating must be between 0.5 and 5',
        'Product rating must be in 0.5 increments'
    );

    // Validate review_text (1-1000 chars, required)
    $reviewText = is_string($payload['review_text'] ?? null) ? trim($payload['review_text']) : '';
    if ($reviewText === '') {
        json_response(['success' => false, 'error' => 'Review text is required'], 400);
    }
    if (mb_strlen($reviewText) > 1000) {
        json_response(['success' => false, 'error' => 'Review text must be 1000 characters or less'], 400);
    }

    // Validate optional image URLs (up to 3 images)
    $rawImageUrls = [];
    foreach (['image1_url', 'image2_url', 'image3_url'] as $imageKey) {
        $value = $payload[$imageKey] ?? null;
        if ($value !== null && !is_string($value)) {
            json_response(['success' => false, 'error' => 'Invalid review image URL'], 400);
        }
        $rawImageUrls[] = is_string($value) ? trim($value) : null;
    }
    
    // Ensure images are from our upload directory (security check)
    $validateImageUrl = function($url) use ($userId) {
        if ($url === null || $url === '') return null;
        $pattern = '#^/media/review-images/review_u' . $userId
            . '_\d{8}_\d{6}_[a-f0-9]{12}\.(?:jpg|png|webp)$#D';
        if (!preg_match($pattern, $url)) {
            json_response(['success' => false, 'error' => 'Review images must belong to your upload session'], 400);
        }
        $root = real_upload_path(data_media_dir('review-images'));
        $path = $root !== null ? realpath($root . DIRECTORY_SEPARATOR . basename($url)) : false;
        $prefix = $root !== null ? rtrim($root, '/\\') . DIRECTORY_SEPARATOR : '';
        if ($path === false || !str_starts_with($path, $prefix) || !is_file($path)) {
            json_response(['success' => false, 'error' => 'Review image not found'], 400);
        }
        return $url;
    };

    [$image1Url, $image2Url, $image3Url] = array_map($validateImageUrl, $rawImageUrls);
    $videoUrl = $payload['video_url'] ?? null;
    if ($videoUrl !== null) {
        if (!is_string($videoUrl) || !preg_match(
            '#^/media/review-images/review_u' . $userId . '_\d{8}_\d{6}_[a-f0-9]{12}\.(?:mp4|webm|mov)$#D',
            $videoUrl
        )) {
            json_response(['success' => false, 'error' => 'Review video must belong to your upload session'], 400);
        }
        $root = real_upload_path(data_media_dir('review-images'));
        $path = $root !== null ? realpath($root . DIRECTORY_SEPARATOR . basename($videoUrl)) : false;
        if ($path === false || !str_starts_with($path, rtrim($root, '/\\') . DIRECTORY_SEPARATOR) || !is_file($path)) {
            json_response(['success' => false, 'error' => 'Review video not found'], 400);
        }
    }
    $presentImageUrls = array_values(array_filter([$image1Url, $image2Url, $image3Url]));
    if (count($presentImageUrls) !== count(array_unique($presentImageUrls))) {
        json_response(['success' => false, 'error' => 'Review images must be unique'], 400);
    }

    $conn = db();
    $conn->set_charset('utf8mb4');

    $productRow = review_product($conn, $productId);

    if (!$productRow) {
        json_response(['success' => false, 'error' => 'Product not found'], 404);
    }

    $sellerId = (int)$productRow['seller_id'];

    // Prevent sellers from reviewing their own products
    if ($sellerId === $userId) {
        json_response(['success' => false, 'error' => 'You cannot review your own product'], 403);
    }

    // Check if user has purchased this product
    $hasPurchased = false;

    // Check purchase_history table (JSON array format)
    $stmt = $conn->prepare('SELECT items FROM purchase_history WHERE user_id = ? LIMIT 1');
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare purchase history lookup');
    }
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $result = $stmt->get_result();
    $historyRow = $result ? $result->fetch_assoc() : null;
    $stmt->close();

    if ($historyRow && !empty($historyRow['items'])) {
        $items = json_decode((string)$historyRow['items'], true);
        if (is_array($items)) {
            foreach ($items as $item) {
                if (is_array($item) && isset($item['product_id']) && (int)$item['product_id'] === $productId) {
                    $hasPurchased = true;
                    break;
                }
            }
        }
    }

    // purchased_items is not consulted: its item_id is that table's own
    // counter, not a listing id, so matching it against product_id let a
    // buyer review an unrelated listing whose id happened to collide.

    if (!$hasPurchased) {
        json_response(['success' => false, 'error' => 'You can only review products you have purchased'], 403);
    }

    // Check if user has already reviewed this product
    $stmt = $conn->prepare('SELECT review_id FROM product_reviews WHERE buyer_user_id = ? AND product_id = ? LIMIT 1');
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare existing review check');
    }
    $stmt->bind_param('ii', $userId, $productId);
    $stmt->execute();
    $result = $stmt->get_result();
    $existingReview = $result ? $result->fetch_assoc() : null;
    $stmt->close();

    if ($existingReview) {
        json_response(['success' => false, 'error' => 'You have already reviewed this product'], 409);
    }

    // Insert the review with optional images
    $stmt = $conn->prepare(
        'INSERT INTO product_reviews (product_id, buyer_user_id, seller_user_id, rating, product_rating, review_text, image1_url, image2_url, image3_url, video_url)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare review insert');
    }
    $stmt->bind_param('iiiddsssss', $productId, $userId, $sellerId, $rating, $productRating, $reviewText, $image1Url, $image2Url, $image3Url, $videoUrl);
    try {
        $success = $stmt->execute();
    } catch (mysqli_sql_exception $e) {
        // A double-submit that passed the check above loses on the unique key.
        if ($e->getCode() === 1062) {
            json_response(['success' => false, 'error' => 'You have already reviewed this product'], 409);
        }
        throw $e;
    }
    $reviewId = $stmt->insert_id;
    $stmt->close();

    if (!$success) {
        throw new RuntimeException('Failed to insert review');
    }

    $reminderStmt = $conn->prepare("DELETE FROM notifications WHERE recipient_user_id = ? AND product_id = ? AND type = 'review_reminder'");
    if ($reminderStmt) {
        $reminderStmt->bind_param('ii', $userId, $productId);
        $reminderStmt->execute();
        $reminderStmt->close();
    }

    // Refresh the seller's cached average. The review is already saved, so a
    // failure here is logged rather than failing the submission.
    try {
        $stmt = $conn->prepare(
            'UPDATE user_accounts SET seller_rating = (
                SELECT AVG(rating) FROM product_reviews WHERE seller_user_id = ?
            ) WHERE user_id = ?'
        );
        $stmt->bind_param('ii', $sellerId, $sellerId);
        $stmt->execute();
        $stmt->close();
    } catch (Throwable $updateError) {
        error_log('seller_rating refresh failed for seller ' . $sellerId . ': ' . $updateError->getMessage());
    }

    notification_review_received($conn, 'product', $sellerId, $userId, $productId, $rating, (int)$reviewId);

    $conn->close();

    json_response([
        'success' => true,
        'review_id' => $reviewId,
        'message' => 'Review submitted successfully'
    ], 200, JSON_UNESCAPED_SLASHES);

} catch (Throwable $e) {
    error_log('submit_review.php error: ' . $e->getMessage());
    json_response(['success' => false, 'error' => 'Internal server error'], 500);
}
