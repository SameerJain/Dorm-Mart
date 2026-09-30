<?php
declare(strict_types=1);

$API_ROOT = dirname(__DIR__);
require_once $API_ROOT . '/helpers/api_bootstrap.php';
init_json_endpoint('POST', ['ok' => false, 'error' => 'Method Not Allowed']);

try {
  // Auth + DB
  require $API_ROOT . '/auth/auth_handle.php';
  require $API_ROOT . '/database/db_connect.php';
  require $API_ROOT . '/helpers/image_upload.php';
  require $API_ROOT . '/helpers/request.php';
  require_once $API_ROOT . '/helpers/notifications.php';
  require_once $API_ROOT . '/scheduled_purchases/helpers.php';
  require_once __DIR__ . '/listing_cap.php';
  require_multipart_formdata();

  auth_boot_session();
  $userId = require_login();

  require_csrf_token($_POST['csrf_token'] ?? null);

  mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
  $conn = db();
  $conn->set_charset('utf8mb4');

  // --- Read FormData ---
  $mode = is_string($_POST['mode'] ?? null) ? trim($_POST['mode']) : 'create';
  $itemId = request_int($_POST, 'id');
  $status = is_string($_POST['status'] ?? null) ? $_POST['status'] : 'Active';
  $savingDraft = $status === 'Draft';

  if (!in_array($mode, ['create', 'update'], true) || !in_array($status, ['Active', 'Draft'], true)) {
    json_response(['ok' => false, 'error' => 'Invalid listing mode.'], 400);
  }

  $titleRaw = is_string($_POST['title'] ?? null) ? trim($_POST['title']) : '';

  // Accept new categories[] or legacy tags[]
  $catsRaw = $_POST['categories'] ?? ($_POST['tags'] ?? []);
  $catsArr = is_array($catsRaw) ? $catsRaw : [$catsRaw];
  if (array_filter($catsArr, fn($value) => !is_string($value))) {
    json_response(['ok' => false, 'error' => 'Invalid categories'], 400);
  }
  $catsArr = array_values(array_unique(array_filter(array_map('trim', $catsArr), fn($v)=>$v!=='')));
  if (count($catsArr) > 3) {
    json_response(['ok' => false, 'error' => 'Select no more than 3 categories'], 400);
  }

  // Accept new itemLocation or legacy meetLocation
  $locationValue = $_POST['itemLocation'] ?? ($_POST['meetLocation'] ?? '');
  $itemLocationRaw = is_string($locationValue) && $locationValue !== '' ? trim($locationValue) : null;

  // Item condition
  $conditionValue = $_POST['condition'] ?? '';
  $itemCondition = is_string($conditionValue) && $conditionValue !== '' ? trim($conditionValue) : null;

  $descriptionValue = $_POST['description'] ?? '';
  $descriptionRaw = is_string($descriptionValue) && $descriptionValue !== '' ? trim($descriptionValue) : null;

  $title = $titleRaw;
  $description = $descriptionRaw;
  $itemLocation = $itemLocationRaw;

  $priceStr = is_string($_POST['price'] ?? null) ? trim($_POST['price']) : '';
  $price     = ($priceStr !== '' && preg_match('/^(?:\d{1,4}(?:\.\d{1,2})?|\.\d{1,2})$/', $priceStr)) ? (float)$priceStr : null;

  $tradesValue = strict_boolean_value($_POST['acceptTrades'] ?? false);
  $priceNegoValue = strict_boolean_value($_POST['priceNegotiable'] ?? false);
  if ($tradesValue === null || $priceNegoValue === null) {
    json_response(['ok' => false, 'error' => 'Invalid listing options'], 400);
  }
  $trades = $tradesValue ? 1 : 0;
  $priceNego = $priceNegoValue ? 1 : 0;

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
  } elseif ($price !== null && price_has_blocked_digits($priceStr)) {
    $errors['price'] = 'Invalid price value.';
  }

  if (!$savingDraft && empty($catsArr)) {
    $errors['categories'] = 'Select at least one category.';
  } else {
    $allowedCategories = json_decode((string)file_get_contents($API_ROOT . '/categories/categories.json'), true);
    $allowedCategories = is_array($allowedCategories) ? $allowedCategories : [];
    foreach ($catsArr as $_cat) {
      if (mb_strlen($_cat) > 100 || !in_array($_cat, $allowedCategories, true)) {
        $errors['categories'] = 'Invalid category.';
        break;
      }
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
    json_response(['ok' => false, 'error' => 'Validation failed', 'errors' => $errors], 400);
  }

  // Reject unauthorized updates and active-listing cap violations before saving uploads.
  $existing = null;
  $publishingDraft = 0;
  $activatingListing = 0;
  if ($mode === 'update') {
    if ($itemId <= 0) {
      json_response(['ok' => false, 'error' => 'Invalid product ID. A valid product ID is required for updates.'], 400);
    }

    $checkStmt = $conn->prepare('SELECT sold, item_status, title, listing_price, photos FROM INVENTORY WHERE product_id = ? AND seller_id = ? LIMIT 1');
    $checkStmt->bind_param('ii', $itemId, $userId);
    $checkStmt->execute();
    $existing = $checkStmt->get_result()->fetch_assoc();
    $checkStmt->close();
    if (!$existing) {
      json_response(['ok' => false, 'error' => 'Product not found or you do not have permission to edit this product.'], 404);
    }

    $soldFlag = (int)($existing['sold'] ?? 0);
    $statusStr = (string)($existing['item_status'] ?? '');
    if ($soldFlag === 1 || $statusStr === 'Sold') {
      json_response(['ok' => false, 'error' => 'Sold listings cannot be edited.'], 403);
    }

    if ($status === 'Draft' && scheduled_purchase_has_active_accepted($conn, $itemId, 0)) {
      json_response([
        'ok' => false,
        'error' => 'Cancel or complete the accepted scheduled purchase before saving this listing as a draft.'
      ], 409);
    }

    $publishingDraft = (int)($statusStr === 'Draft' && $status === 'Active');
    $activatingListing = (int)($statusStr !== 'Active' && $status === 'Active');
  }

  $capAction = $mode === 'update' ? 'publishing this draft' : 'creating a new one';
  if ($status === 'Active' && ($mode === 'create' || $activatingListing === 1)
      && listing_cap_active_count($conn, $userId, $mode === 'update' ? $itemId : 0) >= MAX_ACTIVE_LISTINGS_PER_SELLER) {
    json_response(['ok' => false, 'error' => listing_cap_error($capAction)], 403);
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
      if (array_filter($existingPhotosRaw, fn($value) => !is_string($value))) {
        json_response(['ok' => false, 'error' => 'Invalid existing media'], 400);
      }
      $existingPhotos = array_values(array_unique(array_filter(array_map('trim', $existingPhotosRaw), fn($v) => $v !== '')));
    } elseif (is_string($existingPhotosRaw) && $existingPhotosRaw !== '') {
      $existingPhotos = [trim($existingPhotosRaw)];
    } elseif ($existingPhotosRaw !== []) {
      json_response(['ok' => false, 'error' => 'Invalid existing media'], 400);
    }
    if (count($existingPhotos) > 6) {
      json_response(['ok' => false, 'error' => 'Maximum 6 media files allowed'], 400);
    }

    $storedExistingPhotos = [];
    if (is_string($existing['photos'] ?? null) && $existing['photos'] !== '') {
      $decodedPhotos = json_decode($existing['photos'], true);
      $storedExistingPhotos = is_array($decodedPhotos)
        ? $decodedPhotos
        : array_values(array_filter(array_map('trim', explode(',', $existing['photos']))));
    }
    foreach ($existingPhotos as $existingPhoto) {
      if (!in_array($existingPhoto, $storedExistingPhotos, true)) {
        json_response(['ok' => false, 'error' => 'Existing media does not belong to this listing'], 400);
      }
    }
  }

  // Process new image and video uploads
  $newImageUrls = [];
  $newImagePaths = [];
  $validatedUploads = [];
  if (!empty($_FILES['images'])) {
    if (!is_array($_FILES['images']) || !is_array($_FILES['images']['tmp_name'] ?? null)) {
      json_response(['ok' => false, 'error' => 'Invalid media upload'], 400);
    }
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

    foreach ($_FILES['images']['tmp_name'] as $i => $tmpPath) {
      $uploadError = $_FILES['images']['error'][$i] ?? UPLOAD_ERR_NO_FILE;
      if ($uploadError === UPLOAD_ERR_NO_FILE) continue;
      if ($uploadError !== UPLOAD_ERR_OK || !is_string($tmpPath) || !is_uploaded_file($tmpPath)) {
        json_response(['ok' => false, 'error' => 'Invalid media upload'], 400);
      }
      if (count($validatedUploads) >= $maxFiles) {
        json_response(['ok' => false, 'error' => 'Maximum 6 media files allowed'], 400);
      }

      $mime = $finfo->file($tmpPath) ?: 'application/octet-stream';
      if (!isset($allowedMimeExts[$mime])) {
        json_response(['ok' => false, 'error' => 'Unsupported media type'], 400);
      }
      $sz = @filesize($tmpPath);
      if ($sz === false || $sz <= 0 || $sz > $allowedMimeExts[$mime]['max_bytes']) {
        json_response(['ok' => false, 'error' => 'Media file is too large or empty'], 400);
      }
      if (!uploaded_image_dimensions_are_safe($tmpPath, $mime)) {
        json_response(['ok' => false, 'error' => 'Invalid or oversized image dimensions'], 400);
      }
      $validatedUploads[] = [
        'tmp_path' => $tmpPath,
        'extension' => $allowedMimeExts[$mime]['extension'],
        'is_photo' => str_starts_with($mime, 'image/'),
      ];
    }
  }

  if (count($existingPhotos) + count($validatedUploads) > 6) {
    json_response(['ok' => false, 'error' => 'Maximum 6 media files allowed'], 400);
  }

  $isPhotoUrl = static function (string $url): bool {
    $path = parse_url($url, PHP_URL_PATH);
    $extension = is_string($path) ? strtolower(pathinfo($path, PATHINFO_EXTENSION)) : '';
    return in_array($extension, ['jpg', 'jpeg', 'png', 'webp'], true);
  };
  $existingPhotoCount = count(array_filter($existingPhotos, $isPhotoUrl));
  $newPhotoCount = count(array_filter(
    $validatedUploads,
    static fn(array $upload): bool => $upload['is_photo']
  ));
  if ($existingPhotoCount + $newPhotoCount < 1) {
    $photoError = 'At least one photo is required. Videos are optional and count toward the 6-media limit.';
    json_response([
      'ok' => false,
      'error' => $photoError,
      'errors' => ['images' => $photoError],
    ], 400);
  }

  foreach ($validatedUploads as $upload) {
    $fname = 'img_u' . $userId . '_' . bin2hex(random_bytes(12)) . '.' . $upload['extension'];
    $newImagePath = $imageDirFs . $fname;
    if (!move_uploaded_file($upload['tmp_path'], $newImagePath)) {
      throw new RuntimeException('Unable to save uploaded media');
    }
    $newImageUrls[] = $imageBaseUrl . '/' . $fname;
    $newImagePaths[] = $newImagePath;
  }

  // Merge existing media with new uploads.
  $imageUrls = array_merge($existingPhotos, $newImageUrls);
  foreach ($imageUrls as $index => $url) {
    if (!$isPhotoUrl($url)) continue;
    if ($index > 0) {
      unset($imageUrls[$index]);
      array_unshift($imageUrls, $url);
      $imageUrls = array_values($imageUrls);
    }
    break;
  }

  // --- JSON columns ---
  $categoriesJson = !empty($catsArr)   ? json_encode($catsArr, JSON_UNESCAPED_SLASHES)   : null;
  $photosJson     = !empty($imageUrls) ? json_encode($imageUrls, JSON_UNESCAPED_SLASHES) : null;

  // The checks above ran before the uploads were saved so a doomed request fails
  // fast, but a concurrent request can change the answer since. Re-check under
  // locks now; on failure, discard this request's freshly saved media.
  $rejectLocked = static function (int $code, string $error) use ($conn, &$newImagePaths): void {
    $conn->rollback();
    foreach ($newImagePaths as $path) {
      if (is_file($path)) @unlink($path);
    }
    json_response(['ok' => false, 'error' => $error], $code);
  };

  // --- Create / Update ---
  if ($mode === 'update') {
    $conn->begin_transaction();
    // Seller row first, then the listing row: the same lock order as set_item_status.php.
    $activeCount = listing_cap_locked_active_count($conn, $userId, $itemId);
    $lockStmt = $conn->prepare('SELECT item_status, sold FROM INVENTORY WHERE product_id = ? AND seller_id = ? FOR UPDATE');
    $lockStmt->bind_param('ii', $itemId, $userId);
    $lockStmt->execute();
    $lockedRow = $lockStmt->get_result()->fetch_assoc();
    $lockStmt->close();
    // The listing may have sold or been deleted since the early check; the UPDATE
    // below would then match nothing while we still notified and deleted media.
    if (!$lockedRow) {
      $rejectLocked(404, 'Product not found or you do not have permission to edit this product.');
    }
    $lockedStatus = (string)($lockedRow['item_status'] ?? '');
    if ((int)($lockedRow['sold'] ?? 0) === 1 || $lockedStatus === 'Sold') {
      $rejectLocked(403, 'Sold listings cannot be edited.');
    }
    if ($status === 'Active' && $lockedStatus !== 'Active' && $activeCount >= MAX_ACTIVE_LISTINGS_PER_SELLER) {
      $rejectLocked(403, listing_cap_error($capAction));
    }
    if ($status === 'Draft' && scheduled_purchase_has_active_accepted($conn, $itemId, 0)) {
      $rejectLocked(409, 'Cancel or complete the accepted scheduled purchase before saving this listing as a draft.');
    }

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
      notification_supersede_unread($conn, $itemId, ['price_reduced', 'price_increased']);
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
      notification_supersede_unread($conn, $itemId, ['images_added']);
      notification_for_wishlist($conn, $itemId, [
        'type' => 'images_added', 'title' => $title,
        'message' => 'New media was added to this listing.', 'image_url' => $firstImage,
        'destination' => '/app/viewProduct/' . $itemId,
        'idempotency_key' => 'images-' . $itemId . '-' . bin2hex(random_bytes(8)),
      ]);
    }
    $conn->commit();

    // Media the seller dropped from the listing is no longer referenced by any
    // row, so remove their uploads instead of orphaning the files on disk.
    delete_owned_listing_media(
      array_diff($storedExistingPhotos ?? [], $existingPhotos),
      $userId
    );

    json_response(['ok' => true, 'prod_id' => $itemId, 'status' => $status, 'image_urls' => $imageUrls]);
  }

  // INSERT
  $conn->begin_transaction();
  if ($status === 'Active' && listing_cap_locked_active_count($conn, $userId) >= MAX_ACTIVE_LISTINGS_PER_SELLER) {
    $rejectLocked(403, listing_cap_error($capAction));
  }
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

  $newProductId = (int)$conn->insert_id;
  $conn->commit();

  json_response(['ok' => true, 'product_id' => $newProductId, 'status' => $status, 'image_urls' => $imageUrls]);

} catch (Throwable $e) {
  if (isset($conn) && $conn instanceof mysqli) { try { $conn->rollback(); } catch (Throwable $_) {} }
  foreach ($newImagePaths ?? [] as $newImagePath) {
    if (is_file($newImagePath)) @unlink($newImagePath);
  }
  error_log('[product_listing] ' . $e->getMessage() . "\n" . $e->getTraceAsString());
  json_response(['ok' => false, 'error' => 'Internal Server Error'], 500);
}
