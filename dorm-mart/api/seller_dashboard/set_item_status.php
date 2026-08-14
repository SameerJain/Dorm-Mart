<?php
declare(strict_types=1);

/** Must match product_listing.php */
const MAX_ACTIVE_LISTINGS_PER_SELLER = 25;

require_once __DIR__ . '/../helpers/api_bootstrap.php';
require_once __DIR__ . '/../helpers/request.php';

init_json_endpoint('POST');

require __DIR__ . '/../auth/auth_handle.php';
require __DIR__ . '/../database/db_connect.php';
require_once __DIR__ . '/../helpers/notifications.php';

try {
    $userId = require_login();
    
    $conn = db();
    $conn->set_charset('utf8mb4');

    $input = json_request_body();

    require_csrf_token($input['csrf_token'] ?? null);

    $id = isset($input['id']) ? (int)$input['id'] : 0;
    $status = isset($input['status']) ? (string)$input['status'] : '';

    $valid = ['Active','Pending','Draft','Sold'];
    if ($id <= 0 || !in_array($status, $valid, true)) {
        json_response(['success' => false, 'error' => 'Invalid id or status'], 400);
    }

    $checkStmt = $conn->prepare('SELECT sold, item_status, title, photos FROM INVENTORY WHERE product_id = ? AND seller_id = ? LIMIT 1');
    if (!$checkStmt) {
        throw new RuntimeException('Failed to prepare sold-state check');
    }
    $checkStmt->bind_param('ii', $id, $userId);
    $checkStmt->execute();
    $existing = $checkStmt->get_result()->fetch_assoc();
    $checkStmt->close();
    if (!$existing) {
        json_response(['success' => false, 'error' => 'Not found'], 404);
    }
    $soldFlag = isset($existing['sold']) ? (int)$existing['sold'] : 0;
    $statusStr = isset($existing['item_status']) ? (string)$existing['item_status'] : '';
    if ($soldFlag === 1 || $statusStr === 'Sold') {
        json_response(['success' => false, 'error' => 'Sold listings cannot be edited.'], 403);
    }

    // Enforce cap on active listings per seller when activating
    if ($status === 'Active') {
        $capStmt = $conn->prepare(
            'SELECT COUNT(*) AS cnt FROM INVENTORY WHERE seller_id = ? AND item_status = ? AND product_id != ?'
        );
        $activeLabel = 'Active';
        $capStmt->bind_param('isi', $userId, $activeLabel, $id);
        $capStmt->execute();
        $activeCount = (int)$capStmt->get_result()->fetch_assoc()['cnt'];
        $capStmt->close();

        if ($activeCount >= MAX_ACTIVE_LISTINGS_PER_SELLER) {
            json_response([
                'success' => false,
                'error' => 'You have reached the maximum of ' . MAX_ACTIVE_LISTINGS_PER_SELLER . ' active listings. Please deactivate or remove an existing listing before activating this one.'
            ], 403);
        }
    }

    $conn->begin_transaction();
    // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
    $stmt = $conn->prepare(
        'UPDATE INVENTORY SET item_status = ? WHERE product_id = ? AND seller_id = ?'
        . ' AND (sold IS NULL OR sold = 0) AND (item_status IS NULL OR item_status <> \'Sold\')'
    );
    if (!$stmt) throw new RuntimeException('Failed to prepare update');
    $stmt->bind_param('sii', $status, $id, $userId);  // 's'=string, 'i'=integer, all safely bound
    $stmt->execute();

    if ($stmt->affected_rows < 1) {
        json_response(['success' => false, 'error' => 'Not found'], 404);
    }

    $type = null;
    $message = null;
    $severity = 'info';
    if ($statusStr !== $status && $status === 'Pending') {
        $type = 'item_pending'; $message = $existing['title'] . ' is not currently for sale.'; $severity = 'warning';
    } elseif ($statusStr === 'Pending' && $status === 'Active') {
        $type = 'item_back_on_sale'; $message = $existing['title'] . ' is back on sale.'; $severity = 'success';
    } elseif ($statusStr !== $status && $status === 'Sold') {
        $type = 'item_sold'; $message = $existing['title'] . ' has been sold.'; $severity = 'warning';
    }
    if ($type) {
        notification_for_wishlist($conn, $id, [
            'type' => $type, 'title' => (string)$existing['title'], 'message' => $message,
            'image_url' => notification_first_image($existing['photos'] ?? null), 'severity' => $severity,
            'destination' => $status === 'Active' ? '/app/viewProduct/' . $id : null,
            'idempotency_key' => $type . '-' . $id . '-' . bin2hex(random_bytes(6)),
        ]);
    }
    if ($status === 'Sold') {
        $wishlistDelete = $conn->prepare('DELETE FROM wishlist WHERE product_id = ?');
        if (!$wishlistDelete) throw new RuntimeException('Failed to remove sold item from wishlists');
        $wishlistDelete->bind_param('i', $id);
        $wishlistDelete->execute();
        $wishlistDelete->close();
        $resetCount = $conn->prepare('UPDATE INVENTORY SET sold = 1, wishlisted = 0, date_sold = CURDATE() WHERE product_id = ?');
        if (!$resetCount) throw new RuntimeException('Failed to finalize sold listing');
        $resetCount->bind_param('i', $id);
        $resetCount->execute();
        $resetCount->close();
    }
    $conn->commit();

    json_response(['success' => true, 'id' => $id, 'status' => $status]);
} catch (Throwable $e) {
    if (isset($conn) && $conn instanceof mysqli) { try { $conn->rollback(); } catch (Throwable $_) {} }
    error_log('set_item_status error: ' . $e->getMessage());
    json_response(['success' => false, 'error' => 'Internal server error'], 500);
}

