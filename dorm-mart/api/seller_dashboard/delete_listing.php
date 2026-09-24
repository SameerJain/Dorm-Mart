<?php
declare(strict_types=1);

require_once __DIR__ . '/../helpers/api_bootstrap.php';
require_once __DIR__ . '/../helpers/request.php';

init_json_endpoint('POST');

require __DIR__ . '/../auth/auth_handle.php';
require __DIR__ . '/../database/db_connect.php';
require_once __DIR__ . '/../helpers/listing_reports.php';
require_once __DIR__ . '/../helpers/image_upload.php';

try {
    $userId = require_login();
    
    $conn = db();
    $conn->set_charset('utf8mb4');

    $input = json_request_body();
    
    require_csrf_token($input['csrf_token'] ?? null);
    
    $id = request_int($input, 'id');
    if ($id <= 0) {
        json_response(['success' => false, 'error' => 'Invalid id'], 400);
    }

    $itemStmt = $conn->prepare('SELECT title, photos FROM INVENTORY WHERE product_id = ? AND seller_id = ? LIMIT 1');
    if (!$itemStmt) throw new RuntimeException('Failed to prepare listing snapshot');
    $itemStmt->bind_param('ii', $id, $userId);
    $itemStmt->execute();
    $item = $itemStmt->get_result()->fetch_assoc();
    $itemStmt->close();
    if (!$item) json_response(['success' => false, 'error' => 'Not found'], 404);
    $conn->begin_transaction();
    if (!listing_delete($conn, $id, $userId, $item, 'The item has been removed. This chat has been closed.')) {
        // Not found or not owned by user
        json_response(['success' => false, 'error' => 'Not found'], 404);
    }

    $conn->commit();

    // The row is gone, so the files it referenced are unreachable: drop the
    // ones this seller uploaded. Deleting after the commit means a rolled-back
    // delete never leaves a live listing pointing at missing media.
    delete_owned_listing_media(listing_media_urls($item['photos'] ?? null), $userId);

    json_response(['success' => true, 'id' => $id]);
} catch (Throwable $e) {
    if (isset($conn) && $conn instanceof mysqli) { try { $conn->rollback(); } catch (Throwable $_) {} }
    error_log('delete_listing error: ' . $e->getMessage());
    json_response(['success' => false, 'error' => 'Internal server error'], 500);
}

