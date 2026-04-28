<?php

declare(strict_types=1);

require_once __DIR__ . '/../auth/auth_handle.php';
require_once __DIR__ . '/../database/db_connect.php';
require_once __DIR__ . '/../helpers/api_bootstrap.php';
require_once __DIR__ . '/../helpers/request.php';
require_once __DIR__ . '/helpers.php';

init_json_endpoint('POST');

try {
    $sellerId = require_login();

    $payload = json_request_body_or_error();

    $scheduledRequestId = isset($payload['scheduled_request_id']) ? (int)$payload['scheduled_request_id'] : 0;
    $conversationId = isset($payload['conversation_id']) ? (int)$payload['conversation_id'] : 0;
    $productId = isset($payload['product_id']) ? (int)$payload['product_id'] : 0;

    $isSuccessfulRaw = $payload['is_successful'] ?? null;
    if ($isSuccessfulRaw === null) {
        json_response(['success' => false, 'error' => 'is_successful is required'], 400);
    }
    $isSuccessful = filter_var($isSuccessfulRaw, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
    if ($isSuccessful === null) {
        json_response(['success' => false, 'error' => 'Invalid is_successful value'], 400);
    }

    $finalPrice = isset($payload['final_price']) && $payload['final_price'] !== ''
        ? (float)$payload['final_price']
        : null;
    if ($finalPrice !== null && ($finalPrice < 0 || $finalPrice > 9999.99)) {
        json_response(['success' => false, 'error' => 'Final price must be between 0 and 9,999.99'], 400);
    }

    $sellerNotes = isset($payload['seller_notes']) ? trim((string)$payload['seller_notes']) : '';
    if (strlen($sellerNotes) > 2000) {
        json_response(['success' => false, 'error' => 'Notes cannot exceed 2000 characters'], 400);
    }
    // XSS PROTECTION: Filtering (Layer 1) - blocks patterns before DB storage
    if ($sellerNotes !== '' && contains_xss_pattern($sellerNotes)) {
        json_response(['success' => false, 'error' => 'Invalid characters in seller notes'], 400);
    }

    $failureReason = isset($payload['failure_reason']) ? trim((string)$payload['failure_reason']) : null;
    $failureReasonNotes = isset($payload['failure_reason_notes']) ? trim((string)$payload['failure_reason_notes']) : null;
    $validFailureReasons = ['buyer_no_show', 'insufficient_funds', 'other'];

    if ($isSuccessful) {
        $failureReason = null;
        $failureReasonNotes = null;
    } else {
        if ($failureReason === null || $failureReason === '') {
            json_response(['success' => false, 'error' => 'Failure reason is required for unsuccessful confirmations'], 400);
        }
        if (!in_array($failureReason, $validFailureReasons, true)) {
            json_response(['success' => false, 'error' => 'Invalid failure reason'], 400);
        }
        if ($failureReason === 'other' && ($failureReasonNotes === null || $failureReasonNotes === '')) {
            json_response(['success' => false, 'error' => 'Please provide details for the selected reason'], 400);
        }
        if ($failureReasonNotes !== null && strlen($failureReasonNotes) > 1000) {
            json_response(['success' => false, 'error' => 'Failure notes cannot exceed 1000 characters'], 400);
        }
        // XSS PROTECTION: Filtering (Layer 1) - blocks patterns before DB storage
        if ($failureReasonNotes !== null && $failureReasonNotes !== '' && contains_xss_pattern($failureReasonNotes)) {
            json_response(['success' => false, 'error' => 'Invalid characters in failure reason notes'], 400);
        }
    }

    if ($scheduledRequestId <= 0 || $conversationId <= 0 || $productId <= 0) {
        json_response(['success' => false, 'error' => 'Missing reference ids'], 400);
    }

    $conn = db();
    $conn->set_charset('utf8mb4');

    // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
    $schedStmt = $conn->prepare('
        SELECT
            spr.request_id,
            spr.inventory_product_id,
            spr.seller_user_id,
            spr.buyer_user_id,
            spr.conversation_id,
            spr.meet_location,
            spr.meeting_at,
            spr.description,
            spr.negotiated_price,
            spr.trade_item_description,
            spr.is_trade,
            spr.status,
            inv.title AS item_title,
            inv.listing_price,
            buyer.first_name AS buyer_first,
            buyer.last_name AS buyer_last,
            seller.first_name AS seller_first,
            seller.last_name AS seller_last
        FROM scheduled_purchase_requests spr
        INNER JOIN INVENTORY inv ON inv.product_id = spr.inventory_product_id
        INNER JOIN user_accounts buyer ON buyer.user_id = spr.buyer_user_id
        INNER JOIN user_accounts seller ON seller.user_id = spr.seller_user_id
        WHERE spr.request_id = ?
          AND spr.inventory_product_id = ?
          AND spr.conversation_id = ?
          AND spr.status = \'accepted\'
        LIMIT 1
    ');
    if (!$schedStmt) {
        throw new RuntimeException('Failed to prepare scheduled lookup');
    }
    $schedStmt->bind_param('iii', $scheduledRequestId, $productId, $conversationId);
    $schedStmt->execute();
    $schedRes = $schedStmt->get_result();
    $schedRow = $schedRes ? $schedRes->fetch_assoc() : null;
    $schedStmt->close();

    if (!$schedRow) {
        json_response(['success' => false, 'error' => 'Scheduled purchase not found or not accepted'], 404);
    }

    if ((int)$schedRow['seller_user_id'] !== $sellerId) {
        json_response(['success' => false, 'error' => 'You cannot confirm purchases for this listing'], 403);
    }

    // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
    // Check for any pending confirm purchase requests (block creation if pending)
    // Note: buyer_declined status allows new confirm purchases to be created
    $pendingStmt = $conn->prepare('SELECT * FROM confirm_purchase_requests WHERE scheduled_request_id = ? AND status = \'pending\' ORDER BY confirm_request_id DESC LIMIT 1');
    $pendingStmt->bind_param('i', $scheduledRequestId);
    $pendingStmt->execute();
    $pendingRes = $pendingStmt->get_result();
    $pendingRow = $pendingRes ? $pendingRes->fetch_assoc() : null;
    $pendingStmt->close();

    if ($pendingRow) {
        $pendingRow = auto_finalize_confirm_request($conn, $pendingRow);
        if ($pendingRow && ($pendingRow['status'] ?? '') === 'pending') {
            json_response(['success' => false, 'error' => 'There is already a pending confirmation for this scheduled purchase'], 409);
        }
    }
    
    // Also check for already accepted/confirmed status (block creation if already confirmed)
    // This prevents creating new confirm purchases after a successful confirmation
    $latestStmt = $conn->prepare('SELECT status FROM confirm_purchase_requests WHERE scheduled_request_id = ? ORDER BY confirm_request_id DESC LIMIT 1');
    $latestStmt->bind_param('i', $scheduledRequestId);
    $latestStmt->execute();
    $latestRes = $latestStmt->get_result();
    $latestRow = $latestRes ? $latestRes->fetch_assoc() : null;
    $latestStmt->close();
    
    if ($latestRow && in_array($latestRow['status'], ['buyer_accepted', 'auto_accepted'], true)) {
        json_response(['success' => false, 'error' => 'This transaction has already been confirmed'], 409);
    }

    $buyerId = (int)$schedRow['buyer_user_id'];
    $itemTitle = (string)$schedRow['item_title'];
    $meetingIso = null;
    if (!empty($schedRow['meeting_at'])) {
        $mt = date_create($schedRow['meeting_at'], new DateTimeZone('UTC'));
        if ($mt) {
            $meetingIso = $mt->format(DateTime::ATOM);
        }
    }

    $expiresAt = new DateTime('now', new DateTimeZone('UTC'));
    $expiresAt->modify('+24 hours');
    $expiresAtDb = $expiresAt->format('Y-m-d H:i:s');

    $payloadSnapshot = [
        'item_title' => $itemTitle,
        'buyer_id' => $buyerId,
        'seller_id' => $sellerId,
        'meet_location' => $schedRow['meet_location'],
        'meeting_at' => $meetingIso,
        'description' => $schedRow['description'],
        'negotiated_price' => $schedRow['negotiated_price'] !== null ? (float)$schedRow['negotiated_price'] : null,
        'trade_item_description' => $schedRow['trade_item_description'],
        'is_trade' => (bool)$schedRow['is_trade'],
    ];
    $payloadSnapshotJson = json_encode($payloadSnapshot, JSON_UNESCAPED_SLASHES);
    if ($payloadSnapshotJson === false) {
        throw new RuntimeException('Failed to encode snapshot');
    }

    // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
    $insertStmt = $conn->prepare('
        INSERT INTO confirm_purchase_requests
            (scheduled_request_id, inventory_product_id, seller_user_id, buyer_user_id, conversation_id, is_successful,
             final_price, seller_notes, failure_reason, failure_reason_notes, status, expires_at, payload_snapshot)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, \'pending\', ?, ?)
    ');
    if (!$insertStmt) {
        throw new RuntimeException('Failed to prepare confirm insert');
    }
    $isSuccessfulInt = $isSuccessful ? 1 : 0;
    $insertStmt->bind_param(
        'iiiiiidsssss',
        $scheduledRequestId,
        $productId,
        $sellerId,
        $buyerId,
        $conversationId,
        $isSuccessfulInt,
        $finalPrice,
        $sellerNotes,
        $failureReason,
        $failureReasonNotes,
        $expiresAtDb,
        $payloadSnapshotJson
    );
    $insertStmt->execute();
    $confirmRequestId = (int)$insertStmt->insert_id;
    $insertStmt->close();

    $sellerDisplayName = trim(($schedRow['seller_first'] ?? '') . ' ' . ($schedRow['seller_last'] ?? ''));
    if ($sellerDisplayName === '') {
        $sellerDisplayName = 'User ' . $sellerId;
    }
    $buyerDisplayName = trim(($schedRow['buyer_first'] ?? '') . ' ' . ($schedRow['buyer_last'] ?? ''));
    if ($buyerDisplayName === '') {
        $buyerDisplayName = 'User ' . $buyerId;
    }

    $expiresAtIso = $expiresAt->format(DateTime::ATOM);
    $metadata = [
        'type' => 'confirm_request',
        'confirm_request_id' => $confirmRequestId,
        'scheduled_request_id' => $scheduledRequestId,
        'inventory_product_id' => $productId,
        'product_title' => $itemTitle,
        'buyer_user_id' => $buyerId,
        'seller_user_id' => $sellerId,
        'is_successful' => $isSuccessful,
        'final_price' => $finalPrice,
        'seller_notes' => $sellerNotes,
        'failure_reason' => $failureReason,
        'failure_reason_notes' => $failureReasonNotes,
        'meet_location' => $schedRow['meet_location'],
        'meeting_at' => $meetingIso,
        'expires_at' => $expiresAtIso,
        'snapshot' => $payloadSnapshot,
    ];

    $messageContent = $sellerDisplayName . ' submitted a Confirm Purchase form for ' . $itemTitle . '.';
    insert_confirm_chat_message($conn, $conversationId, $sellerId, $buyerId, $messageContent, $metadata);

    json_response([
        'success' => true,
        'data' => [
            'confirm_request_id' => $confirmRequestId,
            'status' => 'pending',
            'expires_at' => $expiresAtIso,
            'metadata' => $metadata,
        ],
    ]);
} catch (Throwable $e) {
    error_log('confirm-purchase create error: ' . $e->getMessage());
    json_response(['success' => false, 'error' => 'Internal server error'], 500);
}
