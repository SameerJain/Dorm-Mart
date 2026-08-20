<?php

declare(strict_types=1);

require_once __DIR__ . '/../auth/auth_handle.php';
require_once __DIR__ . '/../database/db_connect.php';
require_once __DIR__ . '/../helpers/api_bootstrap.php';
require_once __DIR__ . '/../helpers/request.php';
require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/../payments/helpers.php';

init_json_endpoint('POST');

try {
    $userId = require_login();

    $payload = json_request_body_or_error();

    require_csrf_token($payload['csrf_token'] ?? null);

    $conversationId = request_int($payload, 'conversation_id');
    $productId = request_int($payload, 'product_id');

    if ($conversationId <= 0 || $productId <= 0) {
        json_response(['success' => false, 'error' => 'conversation_id and product_id are required'], 400);
    }

    $conn = db();
    $conn->set_charset('utf8mb4');

    $convRow = confirm_purchase_conversation($conn, $conversationId, $productId);

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

    $schedRow = confirm_purchase_latest_accepted_schedule($conn, $conversationId, $productId, $userId);

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

    $meetingIso = confirm_purchase_utc_atom($schedRow['meeting_at'] ?? null);

    // XSS PROTECTION: Escape user-generated content
    $scheduledInfo = [
        'request_id' => (int)$schedRow['request_id'],
        'buyer_user_id' => (int)$schedRow['buyer_user_id'],
        'meet_location' => $schedRow['meet_location'] ?? '',
        'meeting_at' => $meetingIso,
        'payment_option' => $schedRow['payment_option'] ?? 'manual',
        'payment_amount_cents' => isset($schedRow['payment_amount_cents']) ? (int)$schedRow['payment_amount_cents'] : null,
        'payment_fallback_at' => $schedRow['payment_fallback_at'] ?? null,
        'prefill_final_price' => !empty($schedRow['payment_fallback_at']) && isset($schedRow['payment_amount_cents'])
            ? payment_amount_string((int)$schedRow['payment_amount_cents'])
            : null,
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
    $paymentActive = false;

    if (($schedRow['payment_option'] ?? 'manual') === 'stripe' && empty($schedRow['payment_fallback_at'])) {
        $eligibility = payment_schedule_eligibility($conn, $userId, (int)$schedRow['buyer_user_id']);
        $fallbackReason = null;
        if (empty($eligibility['eligible']) || ($eligibility['mode'] ?? null) !== ($schedRow['payment_mode'] ?? null)) {
            $fallbackReason = 'seller_account_unavailable';
        } elseif (payment_window_state($schedRow) === 'expired') {
            $fallbackReason = 'payment_window_expired';
        }
        if ($fallbackReason !== null) {
            payment_apply_fallback($conn, $schedRow, $fallbackReason);
            $schedRow['payment_fallback_at'] = gmdate('Y-m-d H:i:s');
            $scheduledInfo['payment_fallback_at'] = $schedRow['payment_fallback_at'];
            $scheduledInfo['prefill_final_price'] = payment_amount_string((int)$schedRow['payment_amount_cents']);
        } else {
            $paymentActive = true;
            $canConfirm = false;
            $reasonCode = 'electronic_payment_active';
            $message = 'Confirm Purchase becomes available only if built-in payment falls back to manual confirmation.';
        }
    }

    if ($confirmRow) {
        $confirmRow = auto_finalize_confirm_request($conn, $confirmRow) ?? $confirmRow;
        $latestConfirm = [
            'confirm_request_id' => (int)$confirmRow['confirm_request_id'],
            'status' => $confirmRow['status'],
            'is_successful' => (bool)$confirmRow['is_successful'],
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
        } elseif (
            in_array($confirmRow['status'], ['buyer_accepted', 'auto_accepted', 'payment_completed'], true)
            && (bool)$confirmRow['is_successful']
        ) {
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

    if ($paymentActive) {
        $canConfirm = false;
        $reasonCode = 'electronic_payment_active';
        $message = 'Confirm Purchase becomes available only if built-in payment falls back to manual confirmation.';
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
