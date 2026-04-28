<?php
declare(strict_types=1);

require_once __DIR__ . '/../security/security.php';
require_once __DIR__ . '/../helpers/response.php';
require_once __DIR__ . '/../helpers/request.php';
setSecurityHeaders();
setSecureCORS();

allow_options_request();
require_request_method('GET');

require __DIR__ . '/../auth/auth_handle.php';
require __DIR__ . '/../database/db_connect.php';

try {
    $userId = require_login();
    
    $conn = db();
    $conn->set_charset('utf8mb4');

    $productId = request_int($_GET, 'product_id');
    if ($productId <= 0) {
        json_response(['success' => false, 'error' => 'Invalid product_id'], 400);
    }

    $stmt = $conn->prepare('SELECT wishlist_id FROM wishlist WHERE user_id = ? AND product_id = ?');
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare query');
    }
    $stmt->bind_param('ii', $userId, $productId);
    $stmt->execute();
    $result = $stmt->get_result();
    $isInWishlist = $result->num_rows > 0;
    $stmt->close();

    json_response(['success' => true, 'in_wishlist' => $isInWishlist]);
} catch (Throwable $e) {
    error_log('check_wishlist_status error: ' . $e->getMessage());
    json_response(['success' => false, 'error' => 'Internal server error'], 500);
}
