<?php
declare(strict_types=1);

require __DIR__ . '/security_headers.php';
require __DIR__ . '/input_sanitizer.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Credentials: true');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); echo json_encode(['ok'=>false,'error'=>'Method Not Allowed']); exit; }

require __DIR__ . '/auth/auth_handle.php';
require __DIR__ . '/db_connect.php';

auth_boot_session();
$userId = require_login();

$prod_id = isset($_POST['product_id']) ? trim($_POST['product_id']) : '';
if ($prod_id === '' || !ctype_digit($prod_id)) {
    http_response_code(400);
    echo json_encode(['ok'=>false, 'error'=>'Invalid or missing product_id']);
    exit;
}
$productId = (int)$prod_id;

$conn = db();
$conn->set_charset('utf8mb4');

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
    http_response_code(500);
    echo json_encode(['ok'=>false,'error'=>'DB prepare failed','detail'=>$conn->error]);
    exit;
}

$stmt->bind_param('i', $productId);

if (!$stmt->execute()) {
    http_response_code(500);
    echo json_encode(['ok'=>false,'error'=>'DB execute failed','detail'=>$stmt->error]);
    exit;
}

$res = $stmt->get_result();
$row = $res->fetch_assoc();
$stmt->close();

if (!$row) {
    http_response_code(404);
    echo json_encode(['ok'=>false,'error'=>'Product not found']);
    exit;
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

echo json_encode(['ok'=>true, 'product'=>$row], JSON_UNESCAPED_SLASHES);
