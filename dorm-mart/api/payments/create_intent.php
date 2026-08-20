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
    $buyerId = require_login();
    $payload = json_request_body_or_error();
    require_csrf_token($payload['csrf_token'] ?? null);
    payment_require_feature();
    $requestId = request_int($payload, 'scheduled_request_id');
    if ($requestId <= 0) json_response(['success' => false, 'error' => 'Scheduled purchase is required'], 400);

    $conn = db();
    $schedule = payment_schedule($conn, $requestId);
    if (!$schedule || (int)$schedule['buyer_user_id'] !== $buyerId) {
        json_response(['success' => false, 'error' => 'Scheduled purchase not found'], 404);
    }
    if (($schedule['status'] ?? '') !== 'accepted') {
        json_response(['success' => false, 'error' => 'Scheduled purchase is not accepted'], 409);
    }
    if (($schedule['payment_option'] ?? '') !== 'stripe' || !empty($schedule['payment_fallback_at'])) {
        json_response(['success' => false, 'error' => 'Built-in payment is unavailable for this purchase'], 409);
    }
    if (payment_window_state($schedule) !== 'open') {
        json_response(['success' => false, 'error' => 'The Payment Window is not open'], 409);
    }
    $currentMode = payment_modes_for_pair($conn, (int)$schedule['seller_user_id'], $buyerId);
    if ($currentMode === null || $currentMode !== $schedule['payment_mode']) {
        json_response(['success' => false, 'error' => 'This account pair cannot use built-in payment'], 409);
    }
    $account = payment_account($conn, (int)$schedule['seller_user_id'], (string)$schedule['payment_mode']);
    if (!payment_account_ready($account)) {
        $conn->begin_transaction();
        $locked = payment_schedule($conn, $requestId, true);
        if ($locked) payment_apply_fallback($conn, $locked, 'seller_unavailable');
        $conn->commit();
        json_response(['success' => false, 'error' => 'The seller can no longer accept built-in payment'], 409);
    }

    $amountCents = (int)$schedule['payment_amount_cents'];
    if ($amountCents < PAYMENT_MIN_AMOUNT_CENTS || $amountCents > PAYMENT_MAX_AMOUNT_CENTS) {
        json_response(['success' => false, 'error' => 'Scheduled payment amount is invalid'], 409);
    }
    $mode = (string)$schedule['payment_mode'];
    payment_require_https_for_live($mode);
    $connectedAccountId = (string)$account['stripe_account_id'];
    $stripe = payment_stripe_client($mode);

    $existingStmt = $conn->prepare('SELECT * FROM electronic_payments WHERE scheduled_request_id = ? LIMIT 1');
    $existingStmt->bind_param('i', $requestId);
    $existingStmt->execute();
    $payment = $existingStmt->get_result()->fetch_assoc();
    $existingStmt->close();

    if ($payment) {
        if (in_array($payment['status'], ['canceled', 'refund_pending', 'refunded', 'disputed'], true)) {
            json_response(['success' => false, 'error' => 'This electronic payment can no longer be retried'], 409);
        }
        $intent = $stripe->paymentIntents->retrieve(
            (string)$payment['stripe_payment_intent_id'],
            [],
            payment_stripe_request_options($connectedAccountId)
        );
    } else {
        $intent = $stripe->paymentIntents->create([
            'amount' => $amountCents,
            'currency' => 'usd',
            'payment_method_types' => ['card'],
            'description' => 'Dorm Mart purchase: ' . (string)$schedule['item_title'],
            'metadata' => [
                'scheduled_request_id' => (string)$requestId,
                'inventory_product_id' => (string)$schedule['inventory_product_id'],
                'seller_user_id' => (string)$schedule['seller_user_id'],
                'buyer_user_id' => (string)$buyerId,
                'payment_mode' => $mode,
            ],
        ], payment_stripe_request_options($connectedAccountId, 'dorm-mart-payment-' . $mode . '-' . $requestId));

        $intentId = (string)$intent->id;
        $status = payment_map_intent_status((string)$intent->status);
        $accountId = (int)$account['payment_account_id'];
        $sellerId = (int)$schedule['seller_user_id'];
        $insert = $conn->prepare(
            'INSERT INTO electronic_payments
                (scheduled_request_id, connected_payment_account_id, seller_user_id, buyer_user_id,
                 payment_mode, amount_cents, currency, stripe_connected_account_id,
                 stripe_payment_intent_id, status)
             VALUES (?, ?, ?, ?, ?, ?, \'usd\', ?, ?, ?)
             ON DUPLICATE KEY UPDATE stripe_payment_intent_id = VALUES(stripe_payment_intent_id)'
        );
        if (!$insert) throw new RuntimeException('Failed to prepare electronic payment insert');
        $insert->bind_param(
            'iiiisisss',
            $requestId,
            $accountId,
            $sellerId,
            $buyerId,
            $mode,
            $amountCents,
            $connectedAccountId,
            $intentId,
            $status
        );
        $insert->execute();
        $insert->close();
    }

    $localIntentStatus = (string)$intent->status === 'succeeded'
        ? 'processing'
        : payment_map_intent_status((string)$intent->status);
    $sync = $conn->prepare(
        "UPDATE electronic_payments SET status = ?
          WHERE scheduled_request_id = ?
            AND status NOT IN ('succeeded','refund_pending','refunded','disputed','canceled')"
    );
    if ($sync) {
        $sync->bind_param('si', $localIntentStatus, $requestId);
        $sync->execute();
        $sync->close();
    }

    if (empty($intent->client_secret)) throw new RuntimeException('Stripe did not return a client secret');
    [, $windowEnd] = payment_window($schedule);
    json_response([
        'success' => true,
        'data' => array_merge(payment_stripe_publishable_config($mode, $connectedAccountId), [
            'client_secret' => (string)$intent->client_secret,
            'scheduled_request_id' => $requestId,
            'amount_cents' => $amountCents,
            'currency' => 'usd',
            'payment_status' => $localIntentStatus,
            'window_ends_at' => payment_datetime_atom($windowEnd),
            'is_test_mode' => $mode === 'test',
        ]),
    ]);
} catch (Throwable $e) {
    if (isset($conn)) {
        try { $conn->rollback(); } catch (Throwable $ignored) {}
    }
    error_log('create payment intent error: ' . $e->getMessage());
    json_response(['success' => false, 'error' => 'Unable to start electronic payment'], 500);
}
