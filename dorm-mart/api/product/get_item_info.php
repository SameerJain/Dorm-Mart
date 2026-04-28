<?php
declare(strict_types=1);

require __DIR__ . '/../helpers/api_bootstrap.php';

init_json_endpoint('POST', ['ok' => false, 'error' => 'Method Not Allowed']);

require __DIR__ . '/../auth/auth_handle.php';
require __DIR__ . '/../database/db_connect.php';

auth_boot_session();
$userId = require_login();

$prod_id = isset($_POST['product_id']) ? trim($_POST['product_id']) : '';
if ($prod_id === '' || !ctype_digit($prod_id)) {
    json_response(['ok'=>false,'error'=>'Invalid or missing product_id'], 400);
}
$productId = (int)$prod_id;

$conn = db();
$conn->set_charset('utf8mb4');

// ============================================================================
// SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
// ============================================================================
// Using prepared statement with '?' placeholder and bind_param() to safely
// handle $productId. Even if $productId contains malicious SQL, it cannot
// execute because it's bound as an integer parameter, not concatenated into SQL.
// ============================================================================
$sql = "SELECT 
    product_id,
    title,
    tags,
    meet_location,
    item_condition,
    description,
    photos,
    listing_price,
    trades,
    price_nego,
    date_listed,
    seller_id,
    sold,
    final_price,
    date_sold,
    sold_to
FROM INVENTORY
WHERE product_id = ?";

$stmt = $conn->prepare($sql);
if (!$stmt) {
    error_log('get_item_info: prepare failed: ' . $conn->error);
    json_response(['ok' => false, 'error' => 'Server error'], 500);
}

$stmt->bind_param('i', $productId);

if (!$stmt->execute()) {
    error_log('get_item_info: execute failed: ' . $stmt->error);
    json_response(['ok' => false, 'error' => 'Server error'], 500);
}

$res = $stmt->get_result();
$row = $res->fetch_assoc();
$stmt->close();

if (!$row) {
    json_response(['ok'=>false,'error'=>'Product not found'], 404);
}

/* Decode JSON columns safely */
$row['tags']   = isset($row['tags']) && $row['tags'] !== null ? json_decode($row['tags'], true) : null;
$row['photos'] = isset($row['photos']) && $row['photos'] !== null ? json_decode($row['photos'], true) : null;

/* Normalize booleans/ints */
$row['trades']      = (int)$row['trades'];
$row['price_nego']  = (int)$row['price_nego'];
$row['sold']        = (int)$row['sold'];
$row['seller_id']   = (int)$row['seller_id'];
$row['sold_to']     = isset($row['sold_to']) ? (int)$row['sold_to'] : null;
$row['product_id']  = (int)$row['product_id'];
$row['listing_price']= $row['listing_price'] !== null ? (float)$row['listing_price'] : null;
$row['final_price']  = $row['final_price'] !== null ? (float)$row['final_price'] : null;
$productOutput = [
    'product_id' => $row['product_id'],
    'title' => $row['title'] ?? 'Untitled',
    'tags' => $row['tags'],
    'meet_location' => $row['meet_location'] ?? '',
    'item_condition' => $row['item_condition'] ?? '',
    'description' => $row['description'] ?? '',
    'photos' => $row['photos'],
    'listing_price' => $row['listing_price'],
    'trades' => $row['trades'],
    'price_nego' => $row['price_nego'],
    'date_listed' => $row['date_listed'],
    'seller_id' => $row['seller_id'],
    'sold' => $row['sold'],
    'final_price' => $row['final_price'],
    'date_sold' => $row['date_sold'] ?? null,
    'sold_to' => $row['sold_to'],
];

json_response(['ok'=>true, 'product'=>$productOutput], 200, JSON_UNESCAPED_SLASHES);
