<?php
declare(strict_types=1);

require_once __DIR__ . '/../helpers/api_bootstrap.php';
require_once __DIR__ . '/../helpers/request.php';

init_json_endpoint('GET');

require_once __DIR__ . '/../auth/auth_handle.php';
require_once __DIR__ . '/../database/db_connect.php';

try {
    $userId = require_login();
    
    $conn = db();
    $conn->set_charset('utf8mb4');

    $productId = require_product_id($_GET);

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
    api_fail($e, 'check_wishlist_status');
}
