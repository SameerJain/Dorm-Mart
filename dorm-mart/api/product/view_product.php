<?php
declare(strict_types=1);

// dorm-mart/api/product/view_product.php
// Returns a single product by product_id

require_once __DIR__ . '/../helpers/api_bootstrap.php';
require_once __DIR__ . '/../helpers/inventory.php';
require_once __DIR__ . '/../helpers/recommendations.php';

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
            i.item_status,
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

    // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
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

    // Drafts are private to their seller, including direct product URLs.
    if (($row['item_status'] ?? '') === 'Draft' && (int)$row['seller_id'] !== $userId) {
        json_response(['ok' => false, 'error' => 'Product not found'], 404);
    }

    // Count successful views of published listings by users other than the seller.
    // View tracking is best-effort and must not prevent the product from loading.
    $viewStmt = $mysqli->prepare(
        "UPDATE INVENTORY
         SET view_count = view_count + 1
         WHERE product_id = ?
           AND seller_id <> ?
           AND item_status IN ('Active', 'Pending', 'Sold')"
    );
    if ($viewStmt) {
        $viewStmt->bind_param('ii', $productId, $userId);
        if (!$viewStmt->execute()) {
            error_log('view_product view count update failed: ' . $viewStmt->error);
        }
        $viewStmt->close();
    } else {
        error_log('view_product view count prepare failed: ' . $mysqli->error);
    }

    if ((int)$row['seller_id'] !== $userId && ($row['item_status'] ?? '') !== 'Draft') {
        recommendation_record_behavior($mysqli, $userId, $productId, 'view');
    }

    json_response(inventory_product_payload($row), 200, JSON_UNESCAPED_SLASHES);

} catch (Throwable $e) {
    error_log('view_product error: ' . $e->getMessage());
    json_response(['ok' => false, 'error' => 'Server error'], 500);
}
