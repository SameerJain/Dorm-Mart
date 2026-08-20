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
    $sellerId = require_login();
    $payload = json_request_body_or_error();
    require_csrf_token($payload['csrf_token'] ?? null);
    payment_require_feature();
    $paymentId = request_int($payload, 'electronic_payment_id');
    $relist = strict_boolean_value($payload['relist'] ?? false);
    if ($paymentId <= 0 || $relist === null) {
        json_response(['success' => false, 'error' => 'Invalid refund request'], 400);
    }

    $conn = db();
    $stmt = $conn->prepare('SELECT * FROM electronic_payments WHERE electronic_payment_id = ? LIMIT 1');
    $stmt->bind_param('i', $paymentId);
    $stmt->execute();
    $payment = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    if (!$payment || (int)$payment['seller_user_id'] !== $sellerId) {
        json_response(['success' => false, 'error' => 'Payment not found'], 404);
    }
    if (($payment['status'] ?? '') === 'refunded') {
        json_response(['success' => false, 'error' => 'This payment has already been refunded'], 409);
    }
    if (($payment['status'] ?? '') === 'refund_pending') {
        json_response(['success' => true, 'data' => ['status' => 'refund_pending']]);
    }
    if (($payment['status'] ?? '') !== 'succeeded') {
        json_response(['success' => false, 'error' => 'This payment cannot be refunded'], 409);
    }

    $relistInt = $relist ? 1 : 0;
    $reserve = $conn->prepare(
        "UPDATE electronic_payments
            SET status = 'refund_pending', refund_requested_at = NOW(), refund_relist = ?,
                refund_reason = 'seller_requested', last_error_code = NULL
          WHERE electronic_payment_id = ? AND status = 'succeeded'"
    );
    $reserve->bind_param('ii', $relistInt, $paymentId);
    $reserve->execute();
    if ($reserve->affected_rows !== 1) {
        $reserve->close();
        json_response(['success' => false, 'error' => 'This payment is already being refunded'], 409);
    }
    $reserve->close();

    $mode = (string)$payment['payment_mode'];
    payment_require_https_for_live($mode);
    $stripe = payment_stripe_client($mode);
    $refund = $stripe->refunds->create([
        'payment_intent' => (string)$payment['stripe_payment_intent_id'],
        'reason' => 'requested_by_customer',
        'metadata' => [
            'electronic_payment_id' => (string)$paymentId,
            'scheduled_request_id' => (string)$payment['scheduled_request_id'],
            'relist' => $relist ? '1' : '0',
        ],
    ], payment_stripe_request_options(
        (string)$payment['stripe_connected_account_id'],
        'dorm-mart-refund-' . $mode . '-' . $paymentId
    ));

    $refundId = (string)$refund->id;
    $refundStatus = (string)$refund->status;
    $conn->begin_transaction();
    $update = $conn->prepare(
        "UPDATE electronic_payments
            SET stripe_refund_id = ?, last_error_code = NULL
          WHERE electronic_payment_id = ? AND status = 'refund_pending'"
    );
    $update->bind_param('si', $refundId, $paymentId);
    $update->execute();
    $update->close();
    if ($refundStatus === 'succeeded') {
        payment_finalize_refund_transaction($conn, $paymentId, $refundId);
    }
    $conn->commit();

    json_response(['success' => true, 'data' => ['status' => $refundStatus === 'succeeded' ? 'refunded' : 'refund_pending']]);
} catch (Throwable $e) {
    if (isset($conn)) {
        try { $conn->rollback(); } catch (Throwable $ignored) {}
        if (isset($paymentId) && $paymentId > 0) {
            try {
                $restore = $conn->prepare(
                    "UPDATE electronic_payments
                        SET status = 'succeeded', last_error_code = 'refund_request_failed'
                      WHERE electronic_payment_id = ?
                        AND status = 'refund_pending'
                        AND stripe_refund_id IS NULL"
                );
                if ($restore) {
                    $restore->bind_param('i', $paymentId);
                    $restore->execute();
                    $restore->close();
                }
            } catch (Throwable $ignored) {}
        }
    }
    error_log('payment refund error: ' . $e->getMessage());
    json_response(['success' => false, 'error' => 'Unable to issue the refund'], 500);
}
