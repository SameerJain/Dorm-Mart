<?php

declare(strict_types=1);

require_once __DIR__ . '/../auth/auth_handle.php';
require_once __DIR__ . '/../database/db_connect.php';
require_once __DIR__ . '/../helpers/api_bootstrap.php';
require_once __DIR__ . '/../helpers/request.php';
require_once __DIR__ . '/helpers.php';

init_json_endpoint('POST');

try {
    $userId = require_login();

    $payload = json_request_body_or_error();

    require_csrf_token($payload['csrf_token'] ?? null);

    $productId = require_product_id($payload);

    $conn = db();
    $conn->set_charset('utf8mb4');

    // Only the seller's chat view asks this; anyone else would be probing a
    // stranger's listing for purchase activity.
    $owner = $conn->prepare('SELECT 1 FROM INVENTORY WHERE product_id = ? AND seller_id = ? LIMIT 1');
    if (!$owner) throw new RuntimeException('Failed to prepare listing owner lookup');
    $owner->bind_param('ii', $productId, $userId);
    $owner->execute();
    $isSeller = $owner->get_result()->fetch_row() !== null;
    $owner->close();
    if (!$isSeller) json_response(['success' => false, 'error' => 'Listing not found'], 404);

    $hasActive = scheduled_purchase_has_open_request($conn, $productId);

    json_response([
        'success' => true,
        'has_active' => $hasActive
    ]);
} catch (Throwable $e) {
    api_fail($e, 'scheduled-purchase check_active');
}
