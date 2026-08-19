<?php

declare(strict_types=1);

require_once __DIR__ . '/../auth/auth_handle.php';
require_once __DIR__ . '/../database/db_connect.php';
require_once __DIR__ . '/../helpers/api_bootstrap.php';
require_once __DIR__ . '/../helpers/request.php';
require_once __DIR__ . '/helpers.php';

init_json_endpoint('POST');

try {
    $sellerId = require_login();

    $payload = json_request_body_or_error();

    require_csrf_token($payload['csrf_token'] ?? null);

    $conversationId = request_int($payload, 'conversation_id');
    $productId = request_int($payload, 'product_id');

    if ($conversationId <= 0 || $productId <= 0) {
        json_response(['success' => false, 'error' => 'conversation_id and product_id are required'], 400);
    }

    $conn = db();
    $conn->set_charset('utf8mb4');

    $convRow = confirm_purchase_conversation($conn, $conversationId, $productId);

    if (!$convRow) {
        json_response(['success' => false, 'error' => 'Conversation not found for this product'], 404);
    }

    if ((int)$convRow['seller_id'] !== $sellerId) {
        json_response(['success' => false, 'error' => 'You are not the seller for this listing'], 403);
    }

    $schedRow = confirm_purchase_latest_accepted_schedule($conn, $conversationId, $productId);

    if (!$schedRow) {
        json_response(['success' => false, 'error' => 'No accepted scheduled purchase found for this chat'], 404);
    }

    $meetingIso = confirm_purchase_utc_atom($schedRow['meeting_at'] ?? null);
    $buyerFullName = trim(($schedRow['buyer_first'] ?? '') . ' ' . ($schedRow['buyer_last'] ?? ''));
    if ($buyerFullName === '') {
        $buyerFullName = 'User ' . (int)$schedRow['buyer_user_id'];
    }

    $defaultPrice = null;
    if ($schedRow['negotiated_price'] !== null) {
        $defaultPrice = (float)$schedRow['negotiated_price'];
    } elseif ($schedRow['listing_price'] !== null) {
        $defaultPrice = (float)$schedRow['listing_price'];
    }

    // XSS PROTECTION: Escape user-generated content before returning in JSON
    json_response([
        'success' => true,
        'data' => [
            'scheduled_request_id' => (int)$schedRow['request_id'],
            'inventory_product_id' => (int)$schedRow['inventory_product_id'],
            'conversation_id' => $conversationId,
            'seller_user_id' => (int)$schedRow['seller_user_id'],
            'buyer_user_id' => (int)$schedRow['buyer_user_id'],
            'item_title' => $schedRow['item_title'] ?? 'Untitled',
            'buyer_name' => $buyerFullName,
            'meet_location' => $schedRow['meet_location'] ?? '',
            'meeting_at' => $meetingIso,
            'description' => $schedRow['description'] ?? '',
            'negotiated_price' => $schedRow['negotiated_price'] !== null ? (float)$schedRow['negotiated_price'] : null,
            'is_trade' => (bool)$schedRow['is_trade'],
            'trade_item_description' => $schedRow['trade_item_description'] ?? '',
            'default_final_price' => $defaultPrice,
            'available_failure_reasons' => [
                ['value' => 'buyer_no_show', 'label' => 'Buyer no showed'],
                ['value' => 'insufficient_funds', 'label' => 'Buyer did not have enough money'],
                ['value' => 'other', 'label' => 'Other (describe)'],
            ],
        ],
    ]);
} catch (Throwable $e) {
    error_log('confirm-purchase prefill error: ' . $e->getMessage());
    json_response(['success' => false, 'error' => 'Internal server error'], 500);
}
