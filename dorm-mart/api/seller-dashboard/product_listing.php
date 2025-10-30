<?php
declare(strict_types=1);

// --- Optional debug: .../productListing.php?debug=1 ---
$DEBUG = true;
ini_set('display_errors', '1');
ini_set('display_startup_errors', '1');
error_reporting(E_ALL);

// Always return JSON
header('Content-Type: application/json; charset=utf-8');

try {
  // Resolve API root (this file: /api/seller-dashboard/productListing.php)
  $API_ROOT = dirname(__DIR__); // => /api

  // Security
  require $API_ROOT . '/security/security.php';
  initSecurity();

  // CORS / method
  if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
  if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok'=>false,'error'=>'Method Not Allowed']);
    exit;
  }

  // Auth + DB
  require $API_ROOT . '/auth/auth_handle.php';
  require $API_ROOT . '/database/db_connect.php';

  auth_boot_session();
  $userId = require_login();

  mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
  $conn = db();
  $conn->set_charset('utf8mb4');

  // --- Read FormData ---
  $mode   = isset($_POST['mode']) ? trim((string)$_POST['mode']) : 'create';   // 'create' | 'update'
  $itemId = isset($_POST['id']) ? (int)$_POST['id'] : 0;

  $title = isset($_POST['title']) ? trim((string)$_POST['title']) : '';

  // Accept new categories[] or legacy tags[]
  $catsRaw = $_POST['categories'] ?? ($_POST['tags'] ?? []);
  $catsArr = is_array($catsRaw) ? $catsRaw : [$catsRaw];
  $catsArr = array_values(array_filter(array_map('trim', $catsArr), fn($v)=>$v!==''));
  // Enforce max 3 categories
  if (count($catsArr) > 3) { $catsArr = array_slice($catsArr, 0, 3); }

  // Accept new itemLocation or legacy meetLocation
  $itemLocation  = (($t = ($_POST['itemLocation'] ?? ($_POST['meetLocation'] ?? ''))) !== '') ? trim((string)$t) : null;

  // Item condition
  $itemCondition = (($t = $_POST['condition'] ?? '') !== '') ? trim((string)$t) : null;

  $description = (($t = $_POST['description'] ?? '') !== '') ? trim((string)$t) : null;

  $priceStr  = isset($_POST['price']) ? (string)$_POST['price'] : '';
  $price     = ($priceStr !== '' && is_numeric($priceStr)) ? (float)$priceStr : 0.0;

  $trades    = isset($_POST['acceptTrades'])    ? (int)$_POST['acceptTrades']    : 0; // 0/1
  $priceNego = isset($_POST['priceNegotiable']) ? (int)$_POST['priceNegotiable'] : 0; // 0/1

  // --- Validation ---
  $errors = [];
  if ($title === '')                                     { $errors['title'] = 'Title is required.'; }
  if ($description === null || $description === '')      { $errors['description'] = 'Description is required.'; }
  if ($priceStr === '' || !is_numeric($priceStr) || $price <= 0.0) {
    $errors['price'] = 'Price must be a positive number.';
  }
  if (empty($catsArr))                                   { $errors['categories'] = 'Select at least one category.'; }
  if ($itemLocation === null || $itemLocation === '' || $itemLocation === '<Select Option>') {
    $errors['itemLocation'] = 'Select an item location.';
  }
  if ($itemCondition === null || $itemCondition === '' || $itemCondition === '<Select Option>') {
    $errors['condition'] = 'Select an item condition.';
  }

  if (!empty($errors)) {
    http_response_code(400);
    echo json_encode(['ok'=>false, 'error'=>'Validation failed', 'errors'=>$errors]);
    exit;
  }

  // --- Save images (no finfo) ---
  $imageDirFs   = dirname($API_ROOT) . '/data/images/'; // projectRoot/data/images
  $imageBaseUrl = '/data/images/';
  if (!is_dir($imageDirFs)) { @mkdir($imageDirFs, 0775, true); }

  $imageUrls = [];
  if (!empty($_FILES['images']) && is_array($_FILES['images']['tmp_name'])) {
    $maxFiles   = 6;
    $maxSizeB   = 5 * 1024 * 1024; // 5MB
    $allowedExt = ['jpg','jpeg','png','webp','gif'];
    $cnt = 0;

    foreach ($_FILES['images']['tmp_name'] as $i => $tmpPath) {
      if ($cnt >= $maxFiles) break;
      if (($_FILES['images']['error'][$i] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) continue;
      if (!is_uploaded_file($tmpPath)) continue;

      $sz = @filesize($tmpPath);
      if ($sz !== false && $sz > $maxSizeB) continue;

      $origName = (string)($_FILES['images']['name'][$i] ?? '');
      $ext = strtolower(pathinfo($origName, PATHINFO_EXTENSION));
      if (!in_array($ext, $allowedExt, true)) { $ext = 'jpg'; }

      $fname = uniqid('img_', true) . '.' . $ext;
      if (move_uploaded_file($tmpPath, $imageDirFs . $fname)) {
        $imageUrls[] = $imageBaseUrl . $fname;
        $cnt++;
      }
    }
  }

  // --- JSON columns ---
  $categoriesJson = !empty($catsArr)   ? json_encode($catsArr, JSON_UNESCAPED_SLASHES)   : null;
  $photosJson     = !empty($imageUrls) ? json_encode($imageUrls, JSON_UNESCAPED_SLASHES) : null;

  // --- Create / Update ---
  if ($mode === 'update' && $itemId > 0) {
    $sql = "UPDATE INVENTORY
               SET title=?,
                   categories=?,
                   item_location=?,
                   item_condition=?,
                   description=?,
                   photos=?,
                   listing_price=?,
                   trades=?,
                   price_nego=?
             WHERE product_id=? AND seller_id=?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param(
      'ssssssdiiii',
      $title,
      $categoriesJson,
      $itemLocation,
      $itemCondition,
      $description,
      $photosJson,
      $price,
      $trades,
      $priceNego,
      $itemId,
      $userId
    );
    $stmt->execute();

    echo json_encode([
      'ok'         => true,
      'prod_id' => $itemId,
      'image_urls' => $imageUrls
    ]);
    exit;
  }

  // INSERT
  $sql = "INSERT INTO INVENTORY
            (title, categories, item_location, item_condition, description, photos, listing_price, trades, price_nego, seller_id)
          VALUES
            (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
  $stmt = $conn->prepare($sql);
  $stmt->bind_param(
    'ssssssdiii',
    $title,
    $categoriesJson,
    $itemLocation,
    $itemCondition,
    $description,
    $photosJson,
    $price,
    $trades,
    $priceNego,
    $userId
  );
  $stmt->execute();

  echo json_encode([
    'ok'         => true,
    'product_id' => $conn->insert_id,
    'image_urls' => $imageUrls
  ]);

} catch (Throwable $e) {
  error_log('[productListing] ' . $e->getMessage() . "\n" . $e->getTraceAsString());
  http_response_code(500);
  echo json_encode([
    'ok'    => false,
    'error' => $DEBUG ? $e->getMessage() : 'Internal Server Error',
    'type'  => $DEBUG ? get_class($e) : null,
    'trace' => $DEBUG ? $e->getTraceAsString() : null,
  ]);
}
