<?php
declare(strict_types=1);

// dorm-mart/api/product/view_product.php
// Returns a single product by product_id

require_once __DIR__ . '/../helpers/api_bootstrap.php';
require_once __DIR__ . '/../helpers/inventory.php';

init_json_endpoint('GET', ['ok' => false, 'error' => 'Method Not Allowed']);

try {
    require __DIR__ . '/../auth/auth_handle.php';
    require __DIR__ . '/../database/db_connect.php';

    auth_boot_session();
    $userId = require_login();

    // Accept product_id from query (supports `id` or `product_id`)
    $prodStr = isset($_GET['product_id']) ? (string)$_GET['product_id'] : (isset($_GET['id']) ? (string)$_GET['id'] : '');
    $prodStr = trim($prodStr);
    if ($prodStr === '' || !ctype_digit($prodStr)) {
        json_response(['ok' => false, 'error' => 'Invalid or missing product_id'], 400);
    }
    $productId = (int)$prodStr;

    mysqli_report(MYSQLI_REPORT_OFF);
    $mysqli = db();
    $mysqli->set_charset('utf8mb4');

    $sql = "
        SELECT 
            i.product_id,
            i.title,
            i.categories,
            i.item_location,
            i.item_condition,
            i.description,
            i.photos,
            i.listing_price,
            i.trades,
            i.price_nego,
            i.date_listed,
            i.seller_id,
            i.sold,
            i.final_price,
            i.date_sold,
            i.sold_to,
            ua.first_name,
            ua.last_name,
            ua.email
        FROM INVENTORY AS i
        LEFT JOIN user_accounts AS ua ON i.seller_id = ua.user_id
        WHERE i.product_id = ?
        LIMIT 1
    ";

    // ============================================================================
    // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
    // ============================================================================
    // Using prepared statement with '?' placeholder and bind_param() to safely
    // handle $productId. Even if malicious SQL is in $productId, it cannot execute
    // because it's bound as an integer parameter, not concatenated into SQL.
    // ============================================================================
    $stmt = $mysqli->prepare($sql);
    if (!$stmt) {
        throw new Exception('DB prepare failed: ' . $mysqli->error);
    }
    $stmt->bind_param('i', $productId);  // 'i' = integer type, safely bound as parameter
    if (!$stmt->execute()) {
        $err = $stmt->error;
        $stmt->close();
        throw new Exception('DB execute failed: ' . $err);
    }
    $res = $stmt->get_result();
    $row = $res ? $res->fetch_assoc() : null;
    $stmt->close();

    if (!$row) {
        json_response(['ok' => false, 'error' => 'Product not found'], 404);
    }

    json_response(inventory_product_payload($row), 200, JSON_UNESCAPED_SLASHES);

} catch (Throwable $e) {
    error_log('view_product error: ' . $e->getMessage());
    json_response(['ok' => false, 'error' => 'Server error'], 500);
}
