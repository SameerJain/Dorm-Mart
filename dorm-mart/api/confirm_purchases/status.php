<?php

declare(strict_types=1);

require_once __DIR__ . '/../auth/auth_handle.php';
require_once __DIR__ . '/../database/db_connect.php';
require_once __DIR__ . '/../helpers/api_bootstrap.php';
require_once __DIR__ . '/../helpers/request.php';
require_once __DIR__ . '/helpers.php';

init_json_endpoint('POST');

try {
    $userId = require_login();

    $payload = json_request_body_or_error();

    $conversationId = isset($payload['conversation_id']) ? (int)$payload['conversation_id'] : 0;
    $productId = isset($payload['product_id']) ? (int)$payload['product_id'] : 0;

    if ($conversationId <= 0 || $productId <= 0) {
        json_response(['success' => false, 'error' => 'conversation_id and product_id are required'], 400);
    }

    $conn = db();
    $conn->set_charset('utf8mb4');

    // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
    $convStmt = $conn->prepare('
        SELECT c.conv_id, c.product_id, inv.seller_id, inv.title AS item_title
        FROM conversations c
        INNER JOIN INVENTORY inv ON inv.product_id = c.product_id
        WHERE c.conv_id = ? AND c.product_id = ?
        LIMIT 1
    ');
    if (!$convStmt) {
        throw new RuntimeException('Failed to prepare conversation lookup');
    }
    $convStmt->bind_param('ii', $conversationId, $productId);
    $convStmt->execute();
    $convRes = $convStmt->get_result();
    $convRow = $convRes ? $convRes->fetch_assoc() : null;
    $convStmt->close();

    if (!$convRow) {
        json_response(['success' => false, 'error' => 'Conversation not found for this listing'], 404);
    }

    if ((int)$convRow['seller_id'] !== $userId) {
        json_response([
            'success' => true,
            'data' => [
                'can_confirm' => false,
                'reason_code' => 'not_seller',
                'message' => 'Only the seller can send a Confirm Purchase form.',
            ],
        ]);
        return;
    }

    // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
    $schedStmt = $conn->prepare('
        SELECT *
        FROM scheduled_purchase_requests
        WHERE conversation_id = ?
          AND inventory_product_id = ?
          AND seller_user_id = ?
          AND status = \'accepted\'
        ORDER BY COALESCE(updated_at, buyer_response_at) DESC, request_id DESC
        LIMIT 1
    ');
    if (!$schedStmt) {
        throw new RuntimeException('Failed to prepare scheduled lookup');
    }
    $schedStmt->bind_param('iii', $conversationId, $productId, $userId);
    $schedStmt->execute();
    $schedRes = $schedStmt->get_result();
    $schedRow = $schedRes ? $schedRes->fetch_assoc() : null;
    $schedStmt->close();

    if (!$schedRow) {
        json_response([
            'success' => true,
            'data' => [
                'can_confirm' => false,
                'reason_code' => 'missing_schedule',
                'message' => 'First, send the Schedule Purchase form. Then once the exchange is complete, send the Confirm Purchase form.',
            ],
        ]);
        return;
    }

    $meetingIso = null;
    if (!empty($schedRow['meeting_at'])) {
        $mt = date_create($schedRow['meeting_at'], new DateTimeZone('UTC'));
        if ($mt) {
            $meetingIso = $mt->format(DateTime::ATOM);
        }
    }

    // XSS PROTECTION: Escape user-generated content
    $scheduledInfo = [
        'request_id' => (int)$schedRow['request_id'],
        'buyer_user_id' => (int)$schedRow['buyer_user_id'],
        'meet_location' => $schedRow['meet_location'] ?? '',
        'meeting_at' => $meetingIso,
    ];

    // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
    $confirmStmt = $conn->prepare('
        SELECT *
        FROM confirm_purchase_requests
        WHERE scheduled_request_id = ?
        ORDER BY confirm_request_id DESC
        LIMIT 1
    ');
    $confirmStmt->bind_param('i', $schedRow['request_id']);
    $confirmStmt->execute();
    $confirmRes = $confirmStmt->get_result();
    $confirmRow = $confirmRes ? $confirmRes->fetch_assoc() : null;
    $confirmStmt->close();

    $latestConfirm = null;
    $pendingRequest = null;
    $canConfirm = true;
    $reasonCode = null;
    $message = null;

    if ($confirmRow) {
        $confirmRow = auto_finalize_confirm_request($conn, $confirmRow) ?? $confirmRow;
        $latestConfirm = [
            'confirm_request_id' => (int)$confirmRow['confirm_request_id'],
            'status' => $confirmRow['status'],
            'expires_at' => $confirmRow['expires_at'],
            'buyer_response_at' => $confirmRow['buyer_response_at'],
        ];

        if ($confirmRow['status'] === 'pending') {
            $pendingRequest = [
                'confirm_request_id' => (int)$confirmRow['confirm_request_id'],
                'expires_at' => $confirmRow['expires_at'],
            ];
            $canConfirm = false;
            $reasonCode = 'pending_request';
            $message = 'There is already a Confirm Purchase waiting for buyer response.';
        } elseif (in_array($confirmRow['status'], ['buyer_accepted', 'auto_accepted'], true)) {
            $canConfirm = false;
            $reasonCode = 'already_confirmed';
            $message = 'This transaction has already been confirmed.';
        } elseif ($confirmRow['status'] === 'seller_cancelled') {
            $canConfirm = true;
        } else {
            // buyer_declined or other terminal state – seller may resend
            $canConfirm = true;
        }
    }

    json_response([
        'success' => true,
        'data' => [
            'can_confirm' => $canConfirm,
            'reason_code' => $reasonCode,
            'message' => $message,
            'scheduled_request' => $scheduledInfo,
            'pending_request' => $pendingRequest,
            'latest_confirm' => $latestConfirm,
        ],
    ]);
} catch (Throwable $e) {
    error_log('confirm-purchase status error: ' . $e->getMessage());
    json_response(['success' => false, 'error' => 'Internal server error'], 500);
}
