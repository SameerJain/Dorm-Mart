<?php

declare(strict_types=1);

require_once __DIR__ . '/../auth/auth_handle.php';
require_once __DIR__ . '/../database/db_connect.php';
require_once __DIR__ . '/../helpers/api_bootstrap.php';
require_once __DIR__ . '/../helpers/request.php';
require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/stripe.php';

init_json_endpoint('POST');

try {
    $userId = require_login();
    $payload = json_request_body_or_error();
    require_csrf_token($payload['csrf_token'] ?? null);
    $conversationId = request_int($payload, 'conversation_id');
    $productId = request_int($payload, 'product_id');
    if ($conversationId <= 0 || $productId <= 0) {
        json_response(['success' => false, 'error' => 'Missing reference ids'], 400);
    }

    $conn = db();
    $lookup = $conn->prepare(
        "SELECT request_id
           FROM scheduled_purchase_requests
          WHERE conversation_id = ?
            AND inventory_product_id = ?
            AND status = 'accepted'
            AND (seller_user_id = ? OR buyer_user_id = ?)
          ORDER BY request_id DESC
          LIMIT 1"
    );
    $lookup->bind_param('iiii', $conversationId, $productId, $userId, $userId);
    $lookup->execute();
    $found = $lookup->get_result()->fetch_assoc();
    $lookup->close();
    if (!$found) {
        json_response(['success' => true, 'data' => ['available' => false]]);
    }

    $requestId = (int)$found['request_id'];
    $conn->begin_transaction();
    $schedule = payment_schedule($conn, $requestId, true);
    if (!$schedule) throw new RuntimeException('Scheduled purchase disappeared');

    $paymentStmt = $conn->prepare('SELECT * FROM electronic_payments WHERE scheduled_request_id = ? LIMIT 1 FOR UPDATE');
    $paymentStmt->bind_param('i', $requestId);
    $paymentStmt->execute();
    $payment = $paymentStmt->get_result()->fetch_assoc();
    $paymentStmt->close();

    $completedStmt = $conn->prepare(
        "SELECT confirm_request_id, status
           FROM confirm_purchase_requests
          WHERE scheduled_request_id = ?
            AND is_successful = 1
            AND status IN ('buyer_accepted','auto_accepted','payment_completed')
          ORDER BY confirm_request_id DESC LIMIT 1"
    );
    $completedStmt->bind_param('i', $requestId);
    $completedStmt->execute();
    $completed = $completedStmt->get_result()->fetch_assoc();
    $completedStmt->close();

    $fallbackChanged = false;
    $intentToCancel = null;
    $awaitingSuccessWebhook = false;
    if (
        $payment
        && payment_window_state($schedule) === 'expired'
        && ($payment['status'] ?? null) !== 'succeeded'
        && dm_payments_enabled()
    ) {
        try {
            $stripe = payment_stripe_client((string)$payment['payment_mode']);
            $remoteIntent = $stripe->paymentIntents->retrieve(
                (string)$payment['stripe_payment_intent_id'],
                [],
                payment_stripe_request_options((string)$payment['stripe_connected_account_id'])
            );
            $awaitingSuccessWebhook = (string)$remoteIntent->status === 'succeeded';
        } catch (Throwable $e) {
            error_log('payment status remote sync failed: schedule=' . $requestId . ' error=' . $e->getMessage());
        }
    }
    if (
        ($schedule['payment_option'] ?? 'manual') === 'stripe'
        && empty($schedule['payment_fallback_at'])
        && !$completed
    ) {
        $account = payment_account($conn, (int)$schedule['seller_user_id'], (string)$schedule['payment_mode'], true);
        $currentMode = payment_modes_for_pair($conn, (int)$schedule['seller_user_id'], (int)$schedule['buyer_user_id']);
        $fallbackReason = null;
        if ($currentMode === null || $currentMode !== $schedule['payment_mode']) {
            $fallbackReason = 'account_mode_changed';
        } elseif (!payment_account_ready($account)) {
            $fallbackReason = 'seller_unavailable';
        } elseif (payment_window_state($schedule) === 'expired' && !$awaitingSuccessWebhook && (!$payment || $payment['status'] !== 'succeeded')) {
            $fallbackReason = 'window_expired';
        }
        if ($fallbackReason !== null) {
            $fallbackChanged = payment_apply_fallback($conn, $schedule, $fallbackReason);
            if ($fallbackChanged && $payment) $intentToCancel = $payment;
            $schedule = payment_schedule($conn, $requestId, true) ?? $schedule;
        }
    }
    $conn->commit();

    if ($intentToCancel && dm_payments_enabled()) {
        try {
            $stripe = payment_stripe_client((string)$intentToCancel['payment_mode']);
            $intent = $stripe->paymentIntents->retrieve(
                (string)$intentToCancel['stripe_payment_intent_id'],
                [],
                payment_stripe_request_options((string)$intentToCancel['stripe_connected_account_id'])
            );
            if (in_array((string)$intent->status, ['requires_payment_method','requires_confirmation','requires_action','processing'], true)) {
                $stripe->paymentIntents->cancel(
                    (string)$intent->id,
                    [],
                    payment_stripe_request_options((string)$intentToCancel['stripe_connected_account_id'], 'dorm-mart-cancel-' . $requestId)
                );
            }
        } catch (Throwable $e) {
            error_log('payment intent cancellation failed: schedule=' . $requestId . ' error=' . $e->getMessage());
        }
    }

    [$windowStart, $windowEnd] = payment_window($schedule);
    $windowState = payment_window_state($schedule);
    $isSeller = (int)$schedule['seller_user_id'] === $userId;
    $isBuyer = (int)$schedule['buyer_user_id'] === $userId;
    $fallback = !empty($schedule['payment_fallback_at']);
    $stripeSchedule = ($schedule['payment_option'] ?? 'manual') === 'stripe';
    $paymentStatus = $awaitingSuccessWebhook ? 'processing' : ($payment['status'] ?? null);
    $terminal = $completed !== null;

    json_response([
        'success' => true,
        'data' => [
            'available' => true,
            'scheduled_request_id' => $requestId,
            'payment_option' => $schedule['payment_option'],
            'payment_amount_cents' => $schedule['payment_amount_cents'] !== null ? (int)$schedule['payment_amount_cents'] : null,
            'payment_mode' => $schedule['payment_mode'],
            'is_test_mode' => $schedule['payment_mode'] === 'test',
            'window_state' => $windowState,
            'window_starts_at' => payment_datetime_atom($windowStart),
            'window_ends_at' => payment_datetime_atom($windowEnd),
            'fallback' => $fallback,
            'fallback_reason' => $schedule['payment_fallback_reason'],
            'payment_status' => $paymentStatus,
            'completed' => $terminal,
            'can_pay' => dm_payments_enabled() && $stripeSchedule && !$fallback && !$terminal && $isBuyer && $windowState === 'open',
            'manual_confirm_available' => $isSeller && !$terminal && (!$stripeSchedule || $fallback),
        ],
    ]);
} catch (Throwable $e) {
    if (isset($conn)) {
        try { $conn->rollback(); } catch (Throwable $ignored) {}
    }
    error_log('payment status error: ' . $e->getMessage());
    json_response(['success' => false, 'error' => 'Unable to load payment status'], 500);
}
