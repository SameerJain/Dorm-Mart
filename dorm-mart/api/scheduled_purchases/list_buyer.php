<?php

declare(strict_types=1);

require_once __DIR__ . '/../helpers/api_bootstrap.php';
require_once __DIR__ . '/../auth/auth_handle.php';
require_once __DIR__ . '/../database/db_connect.php';
require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/expire_stale.php';

init_json_endpoint('GET');

try {
    $userId = require_login();

    $conn = db();

    expire_stale_requests($conn);

    json_response(['success' => true, 'data' => scheduled_purchase_list($conn, $userId, 'buyer')]);
} catch (Throwable $e) {
    error_log('scheduled-purchase list_buyer error: ' . $e->getMessage());
    json_response(['success' => false, 'error' => 'Internal server error'], 500);
}
