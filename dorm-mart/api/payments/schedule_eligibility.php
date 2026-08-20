<?php

declare(strict_types=1);

require_once __DIR__ . '/../auth/auth_handle.php';
require_once __DIR__ . '/../database/db_connect.php';
require_once __DIR__ . '/../helpers/api_bootstrap.php';
require_once __DIR__ . '/../helpers/request.php';
require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/../config/app_config.php';

init_json_endpoint('POST');

try {
    $sellerId = require_login();
    $payload = json_request_body_or_error();
    require_csrf_token($payload['csrf_token'] ?? null);
    $conversationId = request_int($payload, 'conversation_id');
    $productId = request_int($payload, 'product_id');
    if ($conversationId <= 0 || $productId <= 0) {
        json_response(['success' => false, 'error' => 'Missing reference ids'], 400);
    }

    $conn = db();
    $stmt = $conn->prepare(
        'SELECT c.user1_id, c.user2_id, inv.seller_id, inv.listing_price, inv.trades
           FROM conversations c
           INNER JOIN INVENTORY inv ON inv.product_id = c.product_id
          WHERE c.conv_id = ? AND c.product_id = ?
          LIMIT 1'
    );
    $stmt->bind_param('ii', $conversationId, $productId);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    if (!$row || (int)$row['seller_id'] !== $sellerId) {
        json_response(['success' => false, 'error' => 'Conversation not found for this listing'], 404);
    }
    $buyerId = (int)$row['user1_id'] === $sellerId ? (int)$row['user2_id'] : (int)$row['user1_id'];
    $eligibility = dm_payments_enabled()
        ? payment_schedule_eligibility($conn, $sellerId, $buyerId)
        : ['eligible' => false, 'mode' => null, 'reason' => 'Electronic payments are not enabled.'];
    $listingPrice = $row['listing_price'] !== null ? (float)$row['listing_price'] : null;

    json_response([
        'success' => true,
        'data' => [
            'eligible' => (bool)$eligibility['eligible'],
            'payment_mode' => $eligibility['mode'],
            'is_test_mode' => ($eligibility['mode'] ?? null) === 'test',
            'reason' => $eligibility['reason'],
            'listing_price' => $listingPrice,
            'listing_price_cents' => $listingPrice !== null ? (int)round($listingPrice * 100) : null,
        ],
    ]);
} catch (Throwable $e) {
    error_log('schedule payment eligibility error: ' . $e->getMessage());
    json_response(['success' => false, 'error' => 'Unable to check payment availability'], 500);
}

