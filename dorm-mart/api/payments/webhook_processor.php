<?php

declare(strict_types=1);

require_once __DIR__ . '/../database/db_connect.php';
require_once __DIR__ . '/../security/security.php';
require_once __DIR__ . '/../helpers/notifications.php';
require_once __DIR__ . '/completion.php';
require_once __DIR__ . '/stripe.php';

function payment_webhook_json(int $status, array $payload): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_SLASHES);
    exit;
}

function payment_refund_late_or_conflicting_intent(
    mysqli $conn,
    array $payment,
    string $reason
): void {
    $paymentId = (int)$payment['electronic_payment_id'];
    $mode = (string)$payment['payment_mode'];
    $stripe = payment_stripe_client($mode);
    $refund = $stripe->refunds->create([
        'payment_intent' => (string)$payment['stripe_payment_intent_id'],
        'metadata' => [
            'electronic_payment_id' => (string)$paymentId,
            'scheduled_request_id' => (string)$payment['scheduled_request_id'],
            'refund_reason' => $reason,
        ],
    ], payment_stripe_request_options(
        (string)$payment['stripe_connected_account_id'],
        'dorm-mart-late-refund-' . $mode . '-' . $paymentId
    ));

    $refundId = (string)$refund->id;
    $update = $conn->prepare(
        "UPDATE electronic_payments
            SET status = 'refund_pending', stripe_refund_id = ?, refund_requested_at = NOW(),
                refund_relist = 0, refund_reason = ?, last_error_code = NULL
          WHERE electronic_payment_id = ?"
    );
    if (!$update) throw new RuntimeException('Failed to prepare late refund update');
    $update->bind_param('ssi', $refundId, $reason, $paymentId);
    $update->execute();
    $update->close();

    if ((string)$refund->status === 'succeeded') {
        payment_finalize_refund_transaction($conn, $paymentId, $refundId);
    }
}

function payment_handle_account_updated(mysqli $conn, string $mode, \Stripe\Event $event): void
{
    $account = $event->data->object;
    $accountId = (string)$account->id;
    $conn->begin_transaction();
    if (!payment_webhook_event_once($conn, $mode, (string)$event->id, (string)$event->type, $accountId)) {
        $conn->commit();
        return;
    }

    $lookup = $conn->prepare(
        'SELECT * FROM connected_payment_accounts
          WHERE payment_mode = ? AND stripe_account_id = ?
          LIMIT 1 FOR UPDATE'
    );
    $lookup->bind_param('ss', $mode, $accountId);
    $lookup->execute();
    $local = $lookup->get_result()->fetch_assoc();
    $lookup->close();
    if (!$local) {
        $conn->commit();
        return;
    }
    if (!empty($local['disconnected_at'])) {
        $conn->commit();
        return;
    }

    $synced = payment_upsert_account($conn, (int)$local['user_id'], $mode, $account->toArray());
    if (!payment_account_ready($synced)) {
        $scheduleStmt = $conn->prepare(
            "SELECT * FROM scheduled_purchase_requests
              WHERE seller_user_id = ?
                AND payment_mode = ?
                AND payment_option = 'stripe'
                AND status = 'accepted'
                AND payment_fallback_at IS NULL
              FOR UPDATE"
        );
        $sellerId = (int)$local['user_id'];
        $scheduleStmt->bind_param('is', $sellerId, $mode);
        $scheduleStmt->execute();
        $result = $scheduleStmt->get_result();
        while ($schedule = $result->fetch_assoc()) {
            payment_apply_fallback($conn, $schedule, 'seller_unavailable');
        }
        $scheduleStmt->close();
    }
    $conn->commit();
}

function payment_handle_intent_succeeded(mysqli $conn, string $mode, \Stripe\Event $event): void
{
    $intent = $event->data->object;
    $intentId = (string)$intent->id;
    $conn->begin_transaction();
    if (!payment_webhook_event_once($conn, $mode, (string)$event->id, (string)$event->type, $intentId)) {
        $conn->commit();
        return;
    }

    $payment = payment_row_by_intent($conn, $mode, $intentId, true);
    if (!$payment) throw new RuntimeException('Stripe PaymentIntent does not map to an electronic payment');
    $eventAccount = (string)($event->account ?? '');
    if ($eventAccount === '' || !hash_equals((string)$payment['stripe_connected_account_id'], $eventAccount)) {
        throw new RuntimeException('Stripe connected account does not match the stored seller');
    }
    if ((int)$intent->amount_received !== (int)$payment['amount_cents'] || strtolower((string)$intent->currency) !== 'usd') {
        throw new RuntimeException('Stripe payment amount or currency does not match the Scheduled Purchase');
    }
    $metadataSchedule = (int)($intent->metadata['scheduled_request_id'] ?? 0);
    if ($metadataSchedule !== (int)$payment['scheduled_request_id']) {
        throw new RuntimeException('Stripe payment metadata does not match the Scheduled Purchase');
    }

    $schedule = payment_schedule($conn, (int)$payment['scheduled_request_id'], true);
    if (!$schedule) throw new RuntimeException('Scheduled Purchase not found for Stripe payment');
    [$windowStart, $windowEnd] = payment_window($schedule);
    $eventTime = (new DateTimeImmutable('@' . (int)$event->created))->setTimezone(new DateTimeZone('UTC'));
    $chargeId = is_string($intent->latest_charge ?? null) ? (string)$intent->latest_charge : null;

    if ($eventTime < $windowStart || $eventTime >= $windowEnd) {
        payment_apply_fallback($conn, $schedule, 'payment_late');
        payment_refund_late_or_conflicting_intent($conn, $payment, 'late_payment');
        $conn->commit();
        return;
    }

    $completion = payment_complete_purchase_transaction($conn, (int)$payment['electronic_payment_id'], $eventTime, $chargeId);
    if (!empty($completion['conflict'])) {
        payment_refund_late_or_conflicting_intent($conn, $payment, 'completion_conflict');
    }
    $conn->commit();
}

function payment_handle_intent_failed(mysqli $conn, string $mode, \Stripe\Event $event): void
{
    $intent = $event->data->object;
    $intentId = (string)$intent->id;
    $conn->begin_transaction();
    if (!payment_webhook_event_once($conn, $mode, (string)$event->id, (string)$event->type, $intentId)) {
        $conn->commit();
        return;
    }
    $payment = payment_row_by_intent($conn, $mode, $intentId, true);
    if ($payment) {
        $errorCode = isset($intent->last_payment_error->code) ? (string)$intent->last_payment_error->code : 'payment_failed';
        $status = payment_map_intent_status((string)$intent->status);
        $update = $conn->prepare('UPDATE electronic_payments SET status = ?, last_error_code = ? WHERE electronic_payment_id = ?');
        $paymentId = (int)$payment['electronic_payment_id'];
        $update->bind_param('ssi', $status, $errorCode, $paymentId);
        $update->execute();
        $update->close();
    }
    $conn->commit();
}

function payment_handle_refund(mysqli $conn, string $mode, \Stripe\Event $event): void
{
    $refund = $event->data->object;
    $refundId = (string)$refund->id;
    $intentId = (string)($refund->payment_intent ?? '');
    $conn->begin_transaction();
    if (!payment_webhook_event_once($conn, $mode, (string)$event->id, (string)$event->type, $refundId)) {
        $conn->commit();
        return;
    }
    $payment = $intentId !== '' ? payment_row_by_intent($conn, $mode, $intentId, true) : null;
    if (!$payment) {
        $lookup = $conn->prepare('SELECT * FROM electronic_payments WHERE payment_mode = ? AND stripe_refund_id = ? LIMIT 1 FOR UPDATE');
        $lookup->bind_param('ss', $mode, $refundId);
        $lookup->execute();
        $payment = $lookup->get_result()->fetch_assoc();
        $lookup->close();
    }
    if (!$payment) throw new RuntimeException('Stripe refund does not map to an electronic payment');
    if (!hash_equals((string)$payment['stripe_connected_account_id'], (string)($event->account ?? ''))) {
        throw new RuntimeException('Stripe refund account does not match the stored seller');
    }

    $paymentId = (int)$payment['electronic_payment_id'];
    $refundStatus = (string)$refund->status;
    if ($refundStatus === 'succeeded') {
        payment_finalize_refund_transaction($conn, $paymentId, $refundId);
    } elseif ($refundStatus === 'failed' || $event->type === 'refund.failed') {
        $failureReason = (string)($refund->failure_reason ?? 'refund_failed');
        $update = $conn->prepare(
            "UPDATE electronic_payments
                SET status = 'refund_failed', stripe_refund_id = ?, last_error_code = ?
              WHERE electronic_payment_id = ?"
        );
        $update->bind_param('ssi', $refundId, $failureReason, $paymentId);
        $update->execute();
        $update->close();
    } else {
        $update = $conn->prepare(
            "UPDATE electronic_payments
                SET status = 'refund_pending', stripe_refund_id = ?, refund_requested_at = COALESCE(refund_requested_at, NOW())
              WHERE electronic_payment_id = ?"
        );
        $update->bind_param('si', $refundId, $paymentId);
        $update->execute();
        $update->close();
    }
    $conn->commit();
}

function payment_handle_dispute(mysqli $conn, string $mode, \Stripe\Event $event): void
{
    $dispute = $event->data->object;
    $disputeId = (string)$dispute->id;
    $chargeId = (string)($dispute->charge ?? '');
    $conn->begin_transaction();
    if (!payment_webhook_event_once($conn, $mode, (string)$event->id, (string)$event->type, $disputeId)) {
        $conn->commit();
        return;
    }
    $lookup = $conn->prepare(
        'SELECT * FROM electronic_payments
          WHERE payment_mode = ? AND stripe_charge_id = ?
          LIMIT 1 FOR UPDATE'
    );
    $lookup->bind_param('ss', $mode, $chargeId);
    $lookup->execute();
    $payment = $lookup->get_result()->fetch_assoc();
    $lookup->close();
    if (!$payment) {
        $conn->commit();
        return;
    }
    if (!hash_equals((string)$payment['stripe_connected_account_id'], (string)($event->account ?? ''))) {
        throw new RuntimeException('Stripe dispute account does not match the stored seller');
    }

    $disputeStatus = (string)($dispute->status ?? 'unknown');
    $paymentId = (int)$payment['electronic_payment_id'];
    $update = $conn->prepare(
        "UPDATE electronic_payments
            SET status = 'disputed', stripe_dispute_id = ?, dispute_status = ?
          WHERE electronic_payment_id = ?"
    );
    $update->bind_param('ssi', $disputeId, $disputeStatus, $paymentId);
    $update->execute();
    $update->close();

    $sellerId = (int)$payment['seller_user_id'];
    if ($sellerId > 0) {
        notification_insert($conn, [
            'recipient_user_id' => $sellerId,
            'type' => 'payment_dispute',
            'product_id' => null,
            'scheduled_request_id' => (int)$payment['scheduled_request_id'],
            'title' => 'Stripe payment dispute',
            'message' => 'A buyer disputed an electronic payment. Review the case in Stripe Dashboard.',
            'severity' => 'urgent',
            'destination' => '/app/setting/payments',
            'idempotency_key' => 'stripe-dispute-' . $disputeId . '-' . $disputeStatus,
        ]);
    }
    $conn->commit();
}

function handle_payment_webhook(string $mode): never
{
    payment_assert_mode($mode);
    dm_enforce_https();
    set_security_headers();
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        payment_webhook_json(405, ['success' => false, 'error' => 'Method Not Allowed']);
    }

    $secret = dm_stripe_webhook_secret($mode);
    if ($secret === '') payment_webhook_json(503, ['success' => false, 'error' => 'Webhook is not configured']);
    $payload = file_get_contents('php://input');
    $signature = $_SERVER['HTTP_STRIPE_SIGNATURE'] ?? '';
    if (!is_string($payload) || $payload === '' || $signature === '') {
        payment_webhook_json(400, ['success' => false, 'error' => 'Invalid webhook request']);
    }

    try {
        $event = \Stripe\Webhook::constructEvent($payload, $signature, $secret);
        $expectedLive = $mode === 'live';
        if ((bool)$event->livemode !== $expectedLive) {
            throw new RuntimeException('Stripe event mode does not match this webhook');
        }
        $conn = db();
        $type = (string)$event->type;
        if ($type === 'account.updated') {
            payment_handle_account_updated($conn, $mode, $event);
        } elseif ($type === 'payment_intent.succeeded') {
            payment_handle_intent_succeeded($conn, $mode, $event);
        } elseif ($type === 'payment_intent.payment_failed') {
            payment_handle_intent_failed($conn, $mode, $event);
        } elseif (in_array($type, ['refund.created', 'refund.updated', 'refund.failed'], true)) {
            payment_handle_refund($conn, $mode, $event);
        } elseif (in_array($type, ['charge.dispute.created', 'charge.dispute.updated', 'charge.dispute.closed'], true)) {
            payment_handle_dispute($conn, $mode, $event);
        }
        payment_webhook_json(200, ['received' => true]);
    } catch (\Stripe\Exception\SignatureVerificationException $e) {
        payment_webhook_json(400, ['success' => false, 'error' => 'Invalid webhook signature']);
    } catch (Throwable $e) {
        if (isset($conn)) {
            try { $conn->rollback(); } catch (Throwable $ignored) {}
        }
        error_log('Stripe webhook error: mode=' . $mode . ' error=' . $e->getMessage());
        payment_webhook_json(500, ['success' => false, 'error' => 'Webhook processing failed']);
    }
}
