<?php
declare(strict_types=1);

/** Max simultaneous Active listings per seller (create + activate paths must match). */
const MAX_ACTIVE_LISTINGS_PER_SELLER = 25;

// Keep diagnostics in server logs; never display PHP errors from this API.
ini_set('display_errors', '0');
ini_set('display_startup_errors', '0');

// Always return JSON
header('Content-Type: application/json; charset=utf-8');

try {
  // Resolve API root (this file: /api/seller_dashboard/product_listing.php)
  $API_ROOT = dirname(__DIR__); // => /api

  // Security
  require $API_ROOT . '/security/security.php';
  init_security();

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
  require $API_ROOT . '/helpers/image_upload.php';
  require_once $API_ROOT . '/helpers/notifications.php';

  auth_boot_session();
  $userId = require_login();

  require_csrf_token($_POST['csrf_token'] ?? null);

  mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
  $conn = db();
  $conn->set_charset('utf8mb4');

  // --- Read FormData ---
  $mode   = isset($_POST['mode']) ? trim((string)$_POST['mode']) : 'create';   // 'create' | 'update'
  $itemId = isset($_POST['id']) ? (int)$_POST['id'] : 0;
  $status = ($_POST['status'] ?? 'Active') === 'Draft' ? 'Draft' : 'Active';
  $savingDraft = $status === 'Draft';

  if (!in_array($mode, ['create', 'update'], true)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Invalid listing mode.']);
    exit;
  }

  $titleRaw = isset($_POST['title']) ? trim((string)$_POST['title']) : '';

  // Accept new categories[] or legacy tags[]
  $catsRaw = $_POST['categories'] ?? ($_POST['tags'] ?? []);
  $catsArr = is_array($catsRaw) ? $catsRaw : [$catsRaw];
  $catsArr = array_values(array_filter(array_map('trim', $catsArr), fn($v)=>$v!==''));
  // Enforce max 3 categories
  if (count($catsArr) > 3) { $catsArr = array_slice($catsArr, 0, 3); }

  // Accept new itemLocation or legacy meetLocation
  $itemLocationRaw  = (($t = ($_POST['itemLocation'] ?? ($_POST['meetLocation'] ?? ''))) !== '') ? trim((string)$t) : null;

  // Item condition
  $itemCondition = (($t = $_POST['condition'] ?? '') !== '') ? trim((string)$t) : null;

  $descriptionRaw = (($t = $_POST['description'] ?? '') !== '') ? trim((string)$t) : null;

  $title = $titleRaw;
  $description = $descriptionRaw;
  $itemLocation = $itemLocationRaw;

  $priceStr  = isset($_POST['price']) ? trim((string)$_POST['price']) : '';
  $price     = ($priceStr !== '' && preg_match('/^(?:\d{1,4}(?:\.\d{1,2})?|\.\d{1,2})$/', $priceStr)) ? (float)$priceStr : null;

  $trades    = isset($_POST['acceptTrades'])    ? (int)$_POST['acceptTrades']    : 0; // 0/1
  $priceNego = isset($_POST['priceNegotiable']) ? (int)$_POST['priceNegotiable'] : 0; // 0/1

  // --- Validation ---
  $errors = [];
  if ($title === '')                        { $errors['title'] = 'Title is required.'; }
  elseif (mb_strlen($title) > 50)          { $errors['title'] = 'Title cannot exceed 50 characters.'; }

  if (!$savingDraft && ($description === null || $description === '')) {
    $errors['description'] = 'Description is required.';
  } elseif ($description !== null && mb_strlen($description) > 1000) {
    $errors['description'] = 'Description cannot exceed 1000 characters.';
  }

  if (!$savingDraft && ($priceStr === '' || $price === null || $price < 0.01)) {
    $errors['price'] = 'Price must be at least $0.01.';
  } elseif ($priceStr !== '' && ($price === null || $price < 0.01)) {
    $errors['price'] = 'Price must be at least $0.01.';
  } elseif ($price !== null && $price > 9999.99) {
    $errors['price'] = 'Price must be $9999.99 or less.';
  } elseif ($price !== null) {
    $priceDigitsOnly = preg_replace('/[^0-9]/', '', $priceStr);
    foreach (['80085','8008','5318008','42069','66666','6969','42042','1488','420','666','69','67'] as $_m) {
      if (strpos($priceDigitsOnly, $_m) !== false) { $errors['price'] = 'Invalid price value.'; break; }
    }
  }

  if (!$savingDraft && empty($catsArr)) {
    $errors['categories'] = 'Select at least one category.';
  } else {
    foreach ($catsArr as $_cat) {
      if (mb_strlen($_cat) > 100) { $errors['categories'] = 'Category name is too long.'; break; }
    }
  }

  $allowedLocations = ['North Campus', 'South Campus', 'Ellicott', 'Other'];
  if (!$savingDraft && ($itemLocation === null || $itemLocation === '' || $itemLocation === '<Select Option>')) {
    $errors['itemLocation'] = 'Select an item location.';
  } elseif ($itemLocation !== null && !in_array($itemLocation, $allowedLocations, true)) {
    $errors['itemLocation'] = 'Invalid item location.';
  }

  $allowedConditions = ['Like New', 'Excellent', 'Good', 'Fair', 'For Parts'];
  if (!$savingDraft && ($itemCondition === null || $itemCondition === '' || $itemCondition === '<Select Option>')) {
    $errors['condition'] = 'Select an item condition.';
  } elseif ($itemCondition !== null && !in_array($itemCondition, $allowedConditions, true)) {
    $errors['condition'] = 'Invalid item condition.';
  }

  if (!empty($errors)) {
    http_response_code(400);
    echo json_encode(['ok'=>false, 'error'=>'Validation failed', 'errors'=>$errors]);
    exit;
  }

  // Reject unauthorized updates and active-listing cap violations before saving uploads.
  $existing = null;
  $publishingDraft = 0;
  $activatingListing = 0;
  if ($mode === 'update') {
    if ($itemId <= 0) {
      http_response_code(400);
      echo json_encode(['ok' => false, 'error' => 'Invalid product ID. A valid product ID is required for updates.']);
      exit;
    }

    $checkStmt = $conn->prepare('SELECT sold, item_status, title, listing_price, photos FROM INVENTORY WHERE product_id = ? AND seller_id = ? LIMIT 1');
    $checkStmt->bind_param('ii', $itemId, $userId);
    $checkStmt->execute();
    $existing = $checkStmt->get_result()->fetch_assoc();
    $checkStmt->close();
    if (!$existing) {
      http_response_code(404);
      echo json_encode(['ok' => false, 'error' => 'Product not found or you do not have permission to edit this product.']);
      exit;
    }

    $soldFlag = (int)($existing['sold'] ?? 0);
    $statusStr = (string)($existing['item_status'] ?? '');
    if ($soldFlag === 1 || $statusStr === 'Sold') {
      http_response_code(403);
      echo json_encode(['ok' => false, 'error' => 'Sold listings cannot be edited.']);
      exit;
    }

    $publishingDraft = (int)($statusStr === 'Draft' && $status === 'Active');
    $activatingListing = (int)($statusStr !== 'Active' && $status === 'Active');
  }

  if ($status === 'Active' && ($mode === 'create' || $activatingListing === 1)) {
    $capSql = 'SELECT COUNT(*) AS cnt FROM INVENTORY WHERE seller_id = ? AND item_status = ?';
    if ($mode === 'update') $capSql .= ' AND product_id != ?';
    $capStmt = $conn->prepare($capSql);
    $activeStatus = 'Active';
    if ($mode === 'update') {
      $capStmt->bind_param('isi', $userId, $activeStatus, $itemId);
    } else {
      $capStmt->bind_param('is', $userId, $activeStatus);
    }
    $capStmt->execute();
    $activeCount = (int)$capStmt->get_result()->fetch_assoc()['cnt'];
    $capStmt->close();

    if ($activeCount >= MAX_ACTIVE_LISTINGS_PER_SELLER) {
      $action = $mode === 'update' ? 'publishing this draft' : 'creating a new one';
      http_response_code(403);
      echo json_encode([
        'ok' => false,
        'error' => 'You have reached the maximum of ' . MAX_ACTIVE_LISTINGS_PER_SELLER . " active listings. Please deactivate or remove an existing listing before {$action}."
      ]);
      exit;
    }
  }

  // --- Save listing media with MIME validation ---
  $imageDirFs   = rtrim(data_images_dir(), '/\\') . DIRECTORY_SEPARATOR;
  $imageBaseUrl = '/images';
  if (!is_dir($imageDirFs)) { @mkdir($imageDirFs, 0775, true); }

  // Handle existing photos for edit mode
  $existingPhotos = [];
  if ($mode === 'update' && $itemId > 0) {
    // Accept existingPhotos[] from POST (can be array or single value)
    $existingPhotosRaw = $_POST['existingPhotos'] ?? [];
    if (is_array($existingPhotosRaw)) {
      $existingPhotos = array_values(array_filter(array_map('trim', $existingPhotosRaw), fn($v) => $v !== ''));
    } elseif (is_string($existingPhotosRaw) && $existingPhotosRaw !== '') {
      $existingPhotos = [trim($existingPhotosRaw)];
    }
    // Limit existing photos to max 6 total
    if (count($existingPhotos) > 6) {
      $existingPhotos = array_slice($existingPhotos, 0, 6);
    }
  }

  // Process new image and video uploads
  $newImageUrls = [];
  $newImagePaths = [];
  if (!empty($_FILES['images']) && is_array($_FILES['images']['tmp_name'])) {
    $maxFiles        = max(0, 6 - count($existingPhotos));
    $allowedMimeExts = [
      'image/jpeg'     => ['extension' => 'jpg',  'max_bytes' => 2 * 1024 * 1024],
      'image/png'      => ['extension' => 'png',  'max_bytes' => 2 * 1024 * 1024],
      'image/webp'     => ['extension' => 'webp', 'max_bytes' => 2 * 1024 * 1024],
      'video/mp4'      => ['extension' => 'mp4',  'max_bytes' => 25 * 1024 * 1024],
      'video/webm'     => ['extension' => 'webm', 'max_bytes' => 25 * 1024 * 1024],
      'video/quicktime'=> ['extension' => 'mov',  'max_bytes' => 25 * 1024 * 1024],
    ];
    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $cnt = 0;

    foreach ($_FILES['images']['tmp_name'] as $i => $tmpPath) {
      if ($cnt >= $maxFiles) break;
      if (($_FILES['images']['error'][$i] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) continue;
      if (!is_uploaded_file($tmpPath)) continue;

      $mime = $finfo->file($tmpPath) ?: 'application/octet-stream';
      if (!isset($allowedMimeExts[$mime])) continue;
      $sz = @filesize($tmpPath);
      if ($sz === false || $sz > $allowedMimeExts[$mime]['max_bytes']) continue;
      $ext = $allowedMimeExts[$mime]['extension'];

      $fname = uniqid('img_', true) . '.' . $ext;
      if (move_uploaded_file($tmpPath, $imageDirFs . $fname)) {
        $newImageUrls[] = $imageBaseUrl . '/' . $fname;
        $newImagePaths[] = $imageDirFs . $fname;
        $cnt++;
      }
    }
  }

  // Merge existing media with new uploads (limit total to 6)
  $imageUrls = array_merge($existingPhotos, $newImageUrls);
  if (count($imageUrls) > 6) {
    $imageUrls = array_slice($imageUrls, 0, 6);
  }

  if (!$savingDraft && empty($imageUrls)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Validation failed', 'errors' => ['images' => 'At least one photo or video is required.']]);
    exit;
  }

  // --- JSON columns ---
  $categoriesJson = !empty($catsArr)   ? json_encode($catsArr, JSON_UNESCAPED_SLASHES)   : null;
  $photosJson     = !empty($imageUrls) ? json_encode($imageUrls, JSON_UNESCAPED_SLASHES) : null;

  // --- Create / Update ---
  if ($mode === 'update') {
    $conn->begin_transaction();

    // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
    $sql = "UPDATE INVENTORY
               SET title=?,
                   categories=?,
                   item_location=?,
                   item_condition=?,
                   description=?,
                   photos=?,
                   listing_price=?,
                   trades=?,
                   price_nego=?,
                   item_status=?,
                   date_listed=IF(? = 1, CURRENT_DATE, date_listed)
             WHERE product_id=? AND seller_id=?
               AND (sold IS NULL OR sold = 0)
               AND (item_status IS NULL OR item_status <> 'Sold')";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param(
      'ssssssdiisiii',
      $title,            // safely bound as string parameter
      $categoriesJson,   // safely bound as string parameter
      $itemLocation,     // safely bound as string parameter
      $itemCondition,    // safely bound as string parameter
      $description,      // safely bound as string parameter
      $photosJson,       // safely bound as string parameter
      $price,            // safely bound as double parameter
      $trades,           // safely bound as integer parameter
      $priceNego,        // safely bound as integer parameter
      $status,
      $publishingDraft,
      $itemId,           // safely bound as integer parameter
      $userId            // safely bound as integer parameter
    );
    $stmt->execute();

    $oldPrice = (float)$existing['listing_price'];
    $firstImage = notification_first_image($photosJson);
    if ($status === 'Active' && abs($oldPrice - (float)$price) >= 0.005) {
      $reduced = (float)$price < $oldPrice;
      notification_for_wishlist($conn, $itemId, [
        'type' => $reduced ? 'price_reduced' : 'price_increased',
        'title' => $title,
        'message' => sprintf('Price %s from $%.2f to $%.2f.', $reduced ? 'reduced' : 'increased', $oldPrice, $price),
        'image_url' => $firstImage, 'severity' => $reduced ? 'success' : 'warning',
        'destination' => '/app/viewProduct/' . $itemId,
        'metadata' => ['old_price' => $oldPrice, 'new_price' => $price],
        'idempotency_key' => 'price-' . $itemId . '-' . bin2hex(random_bytes(8)),
      ]);
    }
    if ($status === 'Active' && !empty($newImageUrls)) {
      notification_for_wishlist($conn, $itemId, [
        'type' => 'images_added', 'title' => $title,
        'message' => 'New media was added to this listing.', 'image_url' => $firstImage,
        'destination' => '/app/viewProduct/' . $itemId,
        'idempotency_key' => 'images-' . $itemId . '-' . bin2hex(random_bytes(8)),
      ]);
    }
    $conn->commit();

    echo json_encode([
      'ok'         => true,
      'prod_id' => $itemId,
      'status' => $status,
      'image_urls' => $imageUrls
    ]);
    exit;
  }

  // INSERT
  $conn->begin_transaction();
  // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
  $sql = "INSERT INTO INVENTORY
            (title, categories, item_location, item_condition, description, photos, listing_price, item_status, trades, price_nego, seller_id)
          VALUES
            (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
  $stmt = $conn->prepare($sql);
  $stmt->bind_param(
    'ssssssdsiii',
    $title,            // safely bound as string parameter
    $categoriesJson,   // safely bound as string parameter
    $itemLocation,     // safely bound as string parameter
    $itemCondition,   // safely bound as string parameter
    $description,      // safely bound as string parameter
    $photosJson,       // safely bound as string parameter
    $price,            // safely bound as double parameter
    $status,           // hardcoded value (safe)
    $trades,           // safely bound as integer parameter
    $priceNego,        // safely bound as integer parameter
    $userId            // safely bound as integer parameter
  );
  $stmt->execute();

  // Create wishlist_notification row for this new listing
  $newProductId = (int)$conn->insert_id;
  $firstImageUrl = notification_first_image($photosJson);
  $wnSql = "INSERT INTO wishlist_notification (seller_id, product_id, title, image_url, unread_count)
            VALUES (?, ?, ?, ?, 0)";
  $wnStmt = $conn->prepare($wnSql);
  $wnStmt->bind_param('iiss', $userId, $newProductId, $title, $firstImageUrl);
  $wnStmt->execute();
  $wnStmt->close();
  $conn->commit();

  echo json_encode([
    'ok'         => true,
    'product_id' => $newProductId,
    'status' => $status,
    'image_urls' => $imageUrls
  ]);

} catch (Throwable $e) {
  if (isset($conn) && $conn instanceof mysqli) { try { $conn->rollback(); } catch (Throwable $_) {} }
  foreach ($newImagePaths ?? [] as $newImagePath) {
    if (is_file($newImagePath)) @unlink($newImagePath);
  }
  error_log('[product_listing] ' . $e->getMessage() . "\n" . $e->getTraceAsString());
  http_response_code(500);
  // XSS PROTECTION: Escape error message to prevent XSS if it contains user input
  // SECURITY: In production, consider removing detailed error fields to prevent information disclosure
  echo json_encode([
    'ok'    => false,
    'error' => 'Internal Server Error',
  ]);
}
