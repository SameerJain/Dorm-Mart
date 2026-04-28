<?php
declare(strict_types=1);

require_once __DIR__ . '/../security/security.php';
require_once __DIR__ . '/../helpers/response.php';
require_once __DIR__ . '/../helpers/request.php';
setSecurityHeaders();
setSecureCORS();

allow_options_request();
require_request_method('POST');

require __DIR__ . '/../auth/auth_handle.php';
require __DIR__ . '/../database/db_connect.php';

try {
    $userId = require_login();

    $conn = db();
    $conn->set_charset('utf8mb4');

    $input = json_request_body();

    /* Conditional CSRF validation - only validate if token is provided */
    $token = $input['csrf_token'] ?? null;
    if ($token !== null && !validate_csrf_token($token)) {
        json_response(['success' => false, 'error' => 'CSRF token validation failed'], 403);
    }

    $productId = request_int($input, 'product_id');
    if ($productId <= 0) {
        json_response(['success' => false, 'error' => 'Invalid product_id'], 400);
    }

    // Reset unread_count to 0 for this seller + product
    $stmt = $conn->prepare(
        'UPDATE wishlist_notification
         SET unread_count = 0
         WHERE seller_id = ? AND product_id = ?'
    );
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare update');
    }

    $stmt->bind_param('ii', $userId, $productId);
    $stmt->execute();
    $stmt->close();

    json_response([
        'success'    => true,
        'product_id' => $productId,
    ]);
} catch (Throwable $e) {
    error_log('mark_item_read error: ' . $e->getMessage());
    json_response(['success' => false, 'error' => 'Internal server error'], 500);
}
