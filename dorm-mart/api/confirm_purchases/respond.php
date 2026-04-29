<?php

declare(strict_types=1);

require_once __DIR__ . '/../auth/auth_handle.php';
require_once __DIR__ . '/../database/db_connect.php';
require_once __DIR__ . '/../helpers/api_bootstrap.php';
require_once __DIR__ . '/../helpers/request.php';
require_once __DIR__ . '/helpers.php';

init_json_endpoint('POST');

try {
    $buyerId = require_login();

    $payload = json_request_body_or_error();
    require_csrf_token($payload['csrf_token'] ?? null);

    $confirmRequestId = isset($payload['confirm_request_id']) ? (int)$payload['confirm_request_id'] : 0;
    $action = isset($payload['action']) ? strtolower(trim((string)$payload['action'])) : '';

    if ($confirmRequestId <= 0 || ($action !== 'accept' && $action !== 'decline')) {
        json_response(['success' => false, 'error' => 'Invalid request'], 400);
    }

    $conn = db();
    $conn->set_charset('utf8mb4');

    $selectStmt = $conn->prepare('
        SELECT cpr.*, inv.title AS item_title
        FROM confirm_purchase_requests cpr
        INNER JOIN INVENTORY inv ON inv.product_id = cpr.inventory_product_id
        WHERE cpr.confirm_request_id = ?
        LIMIT 1
    ');
    if (!$selectStmt) {
        throw new RuntimeException('Failed to prepare confirm lookup');
    }
    $selectStmt->bind_param('i', $confirmRequestId);
    $selectStmt->execute();
    $res = $selectStmt->get_result();
    $row = $res ? $res->fetch_assoc() : null;
    $selectStmt->close();

    if (!$row) {
        json_response(['success' => false, 'error' => 'Confirmation not found'], 404);
    }

    if ((int)$row['buyer_user_id'] !== $buyerId) {
        json_response(['success' => false, 'error' => 'You are not allowed to respond to this confirmation'], 403);
    }

    $row = auto_finalize_confirm_request($conn, $row) ?? $row;
    if (($row['status'] ?? '') !== 'pending') {
        json_response(['success' => false, 'error' => 'This confirmation has already been processed'], 409);
    }

    $nextStatus = $action === 'accept' ? 'buyer_accepted' : 'buyer_declined';
    $updateStmt = $conn->prepare('UPDATE confirm_purchase_requests SET status = ?, buyer_response_at = NOW() WHERE confirm_request_id = ? AND status = \'pending\' LIMIT 1');
    if (!$updateStmt) {
        throw new RuntimeException('Failed to prepare confirm update');
    }
    $updateStmt->bind_param('si', $nextStatus, $confirmRequestId);
    $updateStmt->execute();
    $affected = $updateStmt->affected_rows;
    $updateStmt->close();

    if ($affected === 0) {
        json_response(['success' => false, 'error' => 'Confirmation status already updated'], 409);
    }

    $selectStmt = $conn->prepare('SELECT * FROM confirm_purchase_requests WHERE confirm_request_id = ? LIMIT 1');
    $selectStmt->bind_param('i', $confirmRequestId);
    $selectStmt->execute();
    $res = $selectStmt->get_result();
    $row = $res ? $res->fetch_assoc() : $row;
    $selectStmt->close();

    $conversationId = (int)$row['conversation_id'];
    $metadataType = $action === 'accept' ? 'confirm_accepted' : 'confirm_denied';
    $metadata = build_confirm_response_metadata($row, $metadataType);

    if ($conversationId > 0) {
        $names = get_user_display_names($conn, [$buyerId]);
        $buyerName = $names[$buyerId] ?? ('User ' . $buyerId);
        $actionText = $action === 'accept' ? 'accepted' : 'denied';
        $messageContent = $buyerName . ' has ' . $actionText . ' the Confirm Purchase form.';

        $receiverId = get_conversation_receiver_id($conn, $conversationId, $buyerId);
        if ($receiverId !== null) {
            delete_confirm_request_message($conn, $conversationId, $confirmRequestId);
            insert_confirm_chat_message($conn, $conversationId, $buyerId, $receiverId, $messageContent, $metadata);
        }
    }

    if ($action === 'accept') {
        mark_inventory_as_sold($conn, $row);
        record_purchase_history($conn, $buyerId, (int)$row['inventory_product_id'], [
            'confirm_request_id' => $confirmRequestId,
            'is_successful' => (bool)$row['is_successful'],
            'final_price' => $row['final_price'] !== null ? (float)$row['final_price'] : null,
            'failure_reason' => $row['failure_reason'],
            'seller_notes' => $row['seller_notes'],
            'failure_reason_notes' => $row['failure_reason_notes'],
            'auto_accepted' => false,
        ]);
    }

    $responseAtIso = null;
    if (!empty($row['buyer_response_at'])) {
        $dt = date_create($row['buyer_response_at'], new DateTimeZone('UTC'));
        if ($dt) {
            $responseAtIso = $dt->format(DateTime::ATOM);
        }
    }

    json_response([
        'success' => true,
        'data' => [
            'confirm_request_id' => $confirmRequestId,
            'status' => $nextStatus,
            'buyer_response_at' => $responseAtIso,
            'metadata' => $metadata,
        ],
    ]);
} catch (Throwable $e) {
    error_log('confirm-purchase respond error: ' . $e->getMessage());
    json_response(['success' => false, 'error' => 'Internal server error'], 500);
}
