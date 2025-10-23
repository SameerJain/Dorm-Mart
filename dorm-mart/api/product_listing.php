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

/* ---- Read FormData ---- */
$title         = isset($_POST['title']) ? trim($_POST['title']) : '';
$tagsArr       = isset($_POST['tags']) ? (is_array($_POST['tags']) ? $_POST['tags'] : [$_POST['tags']]) : []; // from tags[]
$tagsArr       = array_values(array_filter(array_map('trim', $tagsArr), fn($v)=>$v!==''));
$meetLocation  = ($tmp = isset($_POST['meetLocation']) ? trim($_POST['meetLocation']) : '') !== '' ? $tmp : null;
$itemCondition = ($tmp = isset($_POST['condition']) ? trim($_POST['condition']) : '') !== '' ? $tmp : null; // column: item_condition
$description   = ($tmp = isset($_POST['description']) ? trim($_POST['description']) : '') !== '' ? $tmp : null;
$price         = isset($_POST['price']) && $_POST['price'] !== '' ? (float)$_POST['price'] : 0.0;
$trades        = isset($_POST['acceptTrades']) ? (int)$_POST['acceptTrades'] : 0;       // expects 0/1
$priceNego     = isset($_POST['priceNegotiable']) ? (int)$_POST['priceNegotiable'] : 0; // expects 0/1

/* ---- Save images to /data/images ---- */
$imageDir = dirname(__DIR__) . '/data/images/';
if (!is_dir($imageDir)) { @mkdir($imageDir, 0775, true); }

$imageUrls = [];
if (!empty($_FILES['images']['tmp_name']) && is_array($_FILES['images']['tmp_name'])) {
    foreach ($_FILES['images']['tmp_name'] as $i => $tmpPath) {
        if ($_FILES['images']['error'][$i] !== UPLOAD_ERR_OK) continue;
        if (!is_uploaded_file($tmpPath)) continue;

        $ext = strtolower(pathinfo($_FILES['images']['name'][$i], PATHINFO_EXTENSION));
        if (!in_array($ext, ['jpg','jpeg','png','webp','gif'], true)) $ext = 'jpg';
        $fname = uniqid('img_', true) . '.' . $ext;

        if (move_uploaded_file($tmpPath, $imageDir . $fname)) {
            $imageUrls[] = "/data/images/" . $fname;
        }
    }
}

/* ---- JSON columns ---- */
$tagsJson   = !empty($tagsArr)   ? json_encode($tagsArr, JSON_UNESCAPED_SLASHES) : null;
$photosJson = !empty($imageUrls) ? json_encode($imageUrls, JSON_UNESCAPED_SLASHES) : null;

/* ---- Insert ---- */
$conn = db();
$conn->set_charset('utf8mb4');

$sql = "INSERT INTO INVENTORY
(title, tags, meet_location, item_condition, description, photos, listing_price, trades, price_nego, seller_id)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

$stmt = $conn->prepare($sql);
if (!$stmt) { http_response_code(500); echo json_encode(['ok'=>false,'error'=>'DB prepare failed','detail'=>$conn->error]); exit; }

/* one binding */
$stmt->bind_param(
    'ssssssdiii',
    $title,        // s
    $tagsJson,     // s (JSON or null -> pass null OK with mysqlnd)
    $meetLocation, // s|null
    $itemCondition,// s|null
    $description,  // s|null
    $photosJson,   // s|null
    $price,        // d
    $trades,       // i
    $priceNego,    // i
    $userId        // i
);

if (!$stmt->execute()) { http_response_code(500); echo json_encode(['ok'=>false,'error'=>'DB execute failed','detail'=>$stmt->error]); exit; }

echo json_encode(['ok'=>true, 'product_id'=>$conn->insert_id, 'image_urls'=>$imageUrls]);
