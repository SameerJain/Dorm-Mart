<?php
declare(strict_types=1);

require_once __DIR__ . '/../helpers/api_bootstrap.php';
require_once __DIR__ . '/../helpers/request.php';

init_json_endpoint('POST');

require_once __DIR__ . '/../auth/auth_handle.php';
require_once __DIR__ . '/../database/db_connect.php';
require_once __DIR__ . '/../helpers/notifications.php';
require_once __DIR__ . '/../scheduled_purchases/helpers.php';
require_once __DIR__ . '/listing_cap.php';

try {
    $userId = require_login();
    
    $conn = db();
    $conn->set_charset('utf8mb4');

    $input = json_request_body();

    require_csrf_token($input['csrf_token'] ?? null);

    $id = request_int($input, 'id');
    $status = is_string($input['status'] ?? null) ? $input['status'] : '';

    $valid = ['Active','Pending','Draft','Sold'];
    if ($id <= 0 || !in_array($status, $valid, true)) {
        json_response(['success' => false, 'error' => 'Invalid id or status'], 400);
    }

    // Every check below runs under locks so it still holds when the UPDATE lands:
    // the seller row (taken first, same order as product_listing.php) serializes
    // the active-listing cap, and the listing row serializes against a buyer
    // accepting a schedule for it at the same moment.
    $conn->begin_transaction();
    $activeCount = listing_cap_locked_active_count($conn, $userId, $id);

    $checkStmt = $conn->prepare('SELECT sold, item_status, title, photos FROM INVENTORY WHERE product_id = ? AND seller_id = ? LIMIT 1 FOR UPDATE');
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
    // While a buyer holds an accepted schedule, the schedule owns the listing's
    // state: Confirm Purchase or payment marks it sold, cancelling relists it.
    // Relisting or selling it by hand here would let a second sale or a Stripe
    // payment land on an item that is already spoken for.
    if ($status !== 'Pending' && scheduled_purchase_has_active_accepted($conn, $id, 0)) {
        $action = ['Draft' => 'saving this listing as a draft', 'Active' => 'relisting this item', 'Sold' => 'marking this item as sold'][$status];
        json_response([
            'success' => false,
            'error' => "Cancel or complete the accepted scheduled purchase before {$action}."
        ], 409);
    }

    if ($status === 'Active' && $activeCount >= MAX_ACTIVE_LISTINGS_PER_SELLER) {
        json_response(['success' => false, 'error' => listing_cap_error('activating this one')], 403);
    }

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
        // Toggling a listing back and forth should leave only its current state.
        notification_supersede_unread($conn, $id, ['item_pending', 'item_back_on_sale', 'item_sold']);
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
    api_fail($e, 'set_item_status', $conn ?? null);
}

