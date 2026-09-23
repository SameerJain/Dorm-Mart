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

    $productId = request_int($payload, 'product_id');

    if ($productId <= 0) {
        json_response(['success' => false, 'error' => 'Invalid product_id'], 400);
    }

    $conn = db();
    $conn->set_charset('utf8mb4');

    $hasActive = scheduled_purchase_has_open_request($conn, $productId);

    json_response([
        'success' => true,
        'has_active' => $hasActive
    ]);
} catch (Throwable $e) {
    error_log('scheduled-purchase check_active error: ' . $e->getMessage());
    json_response(['success' => false, 'error' => 'Internal server error'], 500);
}
