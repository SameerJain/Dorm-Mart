<?php

declare(strict_types=1);

require_once __DIR__ . '/../database/db_connect.php';
require_once __DIR__ . '/../confirm_purchases/helpers.php';
require_once __DIR__ . '/../config/app_config.php';

const PAYMENT_WINDOW_SECONDS = 1800;
const PAYMENT_MIN_AMOUNT_CENTS = 50;
const PAYMENT_MAX_AMOUNT_CENTS = 999999;

function payment_amount_cents_from_value(mixed $value): ?int
{
    if (!is_string($value) && !is_int($value) && !is_float($value)) return null;
    $text = trim((string)$value);
    if (!preg_match('/^(?:\d{1,4})(?:\.\d{1,2})?$/', $text)) return null;
    [$whole, $fraction] = array_pad(explode('.', $text, 2), 2, '');
    $cents = ((int)$whole * 100) + (int)str_pad($fraction, 2, '0');
    return $cents >= PAYMENT_MIN_AMOUNT_CENTS && $cents <= PAYMENT_MAX_AMOUNT_CENTS
        ? $cents
        : null;
}

function payment_mode_for_protected(bool $isProtected): string
{
    return $isProtected ? 'test' : 'live';
}

function payment_user(mysqli $conn, int $userId): ?array
{
    $stmt = $conn->prepare(
        'SELECT user_id, first_name, last_name, email, is_protected
           FROM user_accounts
          WHERE user_id = ?
          LIMIT 1'
    );
    if (!$stmt) throw new RuntimeException('Failed to prepare payment user lookup');
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    return $row ?: null;
}

function payment_account(mysqli $conn, int $userId, string $mode, bool $forUpdate = false): ?array
{
    $sql = 'SELECT * FROM connected_payment_accounts WHERE user_id = ? AND payment_mode = ? LIMIT 1';
    if ($forUpdate) $sql .= ' FOR UPDATE';
    $stmt = $conn->prepare($sql);
    if (!$stmt) throw new RuntimeException('Failed to prepare payment account lookup');
    $stmt->bind_param('is', $userId, $mode);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    return $row ?: null;
}

function payment_account_ready(?array $account): bool
{
    return $account !== null
        && empty($account['disconnected_at'])
        && (int)($account['charges_enabled'] ?? 0) === 1
        && (int)($account['payouts_enabled'] ?? 0) === 1;
}

function payment_upsert_account(mysqli $conn, int $userId, string $mode, array $stripeAccount): array
{
    $stripeId = (string)($stripeAccount['id'] ?? '');
    if ($stripeId === '') throw new InvalidArgumentException('Stripe account id is required');
    $detailsSubmitted = !empty($stripeAccount['details_submitted']) ? 1 : 0;
    $chargesEnabled = !empty($stripeAccount['charges_enabled']) ? 1 : 0;
    $payoutsEnabled = !empty($stripeAccount['payouts_enabled']) ? 1 : 0;

    $stmt = $conn->prepare(
        'INSERT INTO connected_payment_accounts
            (user_id, payment_mode, stripe_account_id, details_submitted, charges_enabled, payouts_enabled, disconnected_at, last_synced_at)
         VALUES (?, ?, ?, ?, ?, ?, NULL, NOW())
         ON DUPLICATE KEY UPDATE
            stripe_account_id = VALUES(stripe_account_id),
            details_submitted = VALUES(details_submitted),
            charges_enabled = VALUES(charges_enabled),
            payouts_enabled = VALUES(payouts_enabled),
            disconnected_at = NULL,
            last_synced_at = NOW()'
    );
    if (!$stmt) throw new RuntimeException('Failed to prepare payment account upsert');
    $stmt->bind_param('issiii', $userId, $mode, $stripeId, $detailsSubmitted, $chargesEnabled, $payoutsEnabled);
    $stmt->execute();
    $stmt->close();

    return payment_account($conn, $userId, $mode) ?? [];
}

function payment_modes_for_pair(mysqli $conn, int $sellerId, int $buyerId): ?string
{
    $stmt = $conn->prepare('SELECT user_id, is_protected FROM user_accounts WHERE user_id IN (?, ?)');
    if (!$stmt) throw new RuntimeException('Failed to prepare payment mode lookup');
    $stmt->bind_param('ii', $sellerId, $buyerId);
    $stmt->execute();
    $result = $stmt->get_result();
    $protected = [];
    while ($row = $result->fetch_assoc()) {
        $protected[(int)$row['user_id']] = (int)$row['is_protected'] === 1;
    }
    $stmt->close();
    if (!array_key_exists($sellerId, $protected) || !array_key_exists($buyerId, $protected)) return null;
    if ($protected[$sellerId] !== $protected[$buyerId]) return null;
    return payment_mode_for_protected($protected[$sellerId]);
}

function payment_schedule_eligibility(mysqli $conn, int $sellerId, int $buyerId): array
{
    if (!dm_payments_enabled()) {
        return ['eligible' => false, 'mode' => null, 'reason' => 'Built-in payment is not enabled yet.'];
    }
    $mode = payment_modes_for_pair($conn, $sellerId, $buyerId);
    if ($mode === null) {
        return ['eligible' => false, 'mode' => null, 'reason' => 'Test and live accounts cannot use built-in payment together.'];
    }
    $account = payment_account($conn, $sellerId, $mode);
    if (!payment_account_ready($account)) {
        return ['eligible' => false, 'mode' => $mode, 'reason' => 'Connect Stripe in Settings before offering built-in payment.'];
    }
    return ['eligible' => true, 'mode' => $mode, 'reason' => null, 'account' => $account];
}

function payment_schedule(mysqli $conn, int $requestId, bool $forUpdate = false): ?array
{
    $sql = '
        SELECT spr.*, inv.title AS item_title, inv.listing_price, inv.sold,
               seller.is_protected AS seller_is_protected,
               buyer.is_protected AS buyer_is_protected,
               cpa.payment_account_id,
               cpa.stripe_account_id,
               cpa.charges_enabled,
               cpa.payouts_enabled,
               cpa.disconnected_at
          FROM scheduled_purchase_requests spr
          INNER JOIN INVENTORY inv ON inv.product_id = spr.inventory_product_id
          INNER JOIN user_accounts seller ON seller.user_id = spr.seller_user_id
          INNER JOIN user_accounts buyer ON buyer.user_id = spr.buyer_user_id
          LEFT JOIN connected_payment_accounts cpa
            ON cpa.user_id = spr.seller_user_id
           AND cpa.payment_mode = spr.payment_mode
         WHERE spr.request_id = ?
         LIMIT 1';
    if ($forUpdate) $sql .= ' FOR UPDATE';
    $stmt = $conn->prepare($sql);
    if (!$stmt) throw new RuntimeException('Failed to prepare payment schedule lookup');
    $stmt->bind_param('i', $requestId);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    return $row ?: null;
}

function payment_window(array $schedule): array
{
    $start = DateTimeImmutable::createFromFormat(
        'Y-m-d H:i:s',
        (string)($schedule['meeting_at'] ?? ''),
        new DateTimeZone('UTC')
    );
    if (!$start) throw new RuntimeException('Scheduled purchase has an invalid meeting time');
    return [$start, $start->modify('+' . PAYMENT_WINDOW_SECONDS . ' seconds')];
}

function payment_window_state(array $schedule, ?DateTimeImmutable $now = null): string
{
    [$start, $end] = payment_window($schedule);
    $now ??= new DateTimeImmutable('now', new DateTimeZone('UTC'));
    if ($now < $start) return 'upcoming';
    if ($now >= $end) return 'expired';
    return 'open';
}

function payment_datetime_atom(DateTimeInterface $value): string
{
    return $value->setTimezone(new DateTimeZone('UTC'))->format(DateTime::ATOM);
}

function payment_amount_string(int $amountCents): string
{
    return number_format($amountCents / 100, 2, '.', '');
}

function payment_insert_fallback_message(mysqli $conn, array $schedule, string $reason): void
{
    $conversationId = (int)($schedule['conversation_id'] ?? 0);
    $buyerId = (int)($schedule['buyer_user_id'] ?? 0);
    $sellerId = (int)($schedule['seller_user_id'] ?? 0);
    if ($conversationId <= 0 || $buyerId <= 0 || $sellerId <= 0) return;

    insert_confirm_chat_message(
        $conn,
        $conversationId,
        $buyerId,
        $sellerId,
        'Built-in payment is unavailable. This purchase has returned to manual confirmation.',
        [
            'type' => 'payment_fallback',
            'scheduled_request_id' => (int)$schedule['request_id'],
            'inventory_product_id' => (int)$schedule['inventory_product_id'],
            'payment_fallback_reason' => $reason,
            'payment_amount_cents' => isset($schedule['payment_amount_cents']) ? (int)$schedule['payment_amount_cents'] : null,
        ]
    );
}

function payment_apply_fallback(mysqli $conn, array $schedule, string $reason): bool
{
    if (($schedule['payment_option'] ?? 'manual') !== 'stripe' || !empty($schedule['payment_fallback_at'])) {
        return false;
    }
    $requestId = (int)$schedule['request_id'];
    $stmt = $conn->prepare(
        'UPDATE scheduled_purchase_requests
            SET payment_fallback_at = NOW(), payment_fallback_reason = ?
          WHERE request_id = ? AND payment_fallback_at IS NULL'
    );
    if (!$stmt) throw new RuntimeException('Failed to prepare payment fallback');
    $stmt->bind_param('si', $reason, $requestId);
    $stmt->execute();
    $changed = $stmt->affected_rows > 0;
    $stmt->close();
    if (!$changed) return false;

    payment_insert_fallback_message($conn, $schedule, $reason);
    $notified = $conn->prepare(
        'UPDATE scheduled_purchase_requests SET payment_fallback_notified_at = NOW() WHERE request_id = ?'
    );
    if ($notified) {
        $notified->bind_param('i', $requestId);
        $notified->execute();
        $notified->close();
    }
    return true;
}

function payment_webhook_event_once(
    mysqli $conn,
    string $mode,
    string $eventId,
    string $eventType,
    ?string $objectId
): bool {
    $stmt = $conn->prepare(
        'INSERT IGNORE INTO stripe_webhook_events
            (payment_mode, stripe_event_id, event_type, stripe_object_id)
         VALUES (?, ?, ?, ?)'
    );
    if (!$stmt) throw new RuntimeException('Failed to prepare Stripe event insert');
    $stmt->bind_param('ssss', $mode, $eventId, $eventType, $objectId);
    $stmt->execute();
    $inserted = $stmt->affected_rows > 0;
    $stmt->close();
    return $inserted;
}

function payment_row_by_intent(mysqli $conn, string $mode, string $intentId, bool $forUpdate = false): ?array
{
    $sql = 'SELECT * FROM electronic_payments WHERE payment_mode = ? AND stripe_payment_intent_id = ? LIMIT 1';
    if ($forUpdate) $sql .= ' FOR UPDATE';
    $stmt = $conn->prepare($sql);
    if (!$stmt) throw new RuntimeException('Failed to prepare electronic payment lookup');
    $stmt->bind_param('ss', $mode, $intentId);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    return $row ?: null;
}

function payment_map_intent_status(string $status): string
{
    return match ($status) {
        'requires_action', 'requires_source_action' => 'requires_action',
        'processing' => 'processing',
        'succeeded' => 'succeeded',
        'canceled' => 'canceled',
        default => 'requires_payment_method',
    };
}

function payment_finalize_refund_transaction(
    mysqli $conn,
    int $electronicPaymentId,
    string $stripeRefundId
): bool {
    $stmt = $conn->prepare(
        'SELECT ep.*, spr.inventory_product_id, spr.conversation_id,
                spr.seller_user_id AS schedule_seller_id,
                spr.buyer_user_id AS schedule_buyer_id
           FROM electronic_payments ep
           INNER JOIN scheduled_purchase_requests spr ON spr.request_id = ep.scheduled_request_id
          WHERE ep.electronic_payment_id = ?
          LIMIT 1
          FOR UPDATE'
    );
    if (!$stmt) throw new RuntimeException('Failed to prepare refunded payment lookup');
    $stmt->bind_param('i', $electronicPaymentId);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    if (!$row) throw new RuntimeException('Electronic payment not found');
    if (($row['status'] ?? '') === 'refunded') return false;

    $update = $conn->prepare(
        "UPDATE electronic_payments
            SET status = 'refunded', stripe_refund_id = ?, refunded_at = NOW(), last_error_code = NULL
          WHERE electronic_payment_id = ?"
    );
    if (!$update) throw new RuntimeException('Failed to prepare refunded payment update');
    $update->bind_param('si', $stripeRefundId, $electronicPaymentId);
    $update->execute();
    $update->close();

    $productId = (int)$row['inventory_product_id'];
    if ((int)($row['refund_relist'] ?? 0) === 1 && $productId > 0) {
        $active = 'Active';
        $relist = $conn->prepare(
            'UPDATE INVENTORY
                SET item_status = ?, sold = 0, final_price = NULL, date_sold = NULL, sold_to = NULL
              WHERE product_id = ?'
        );
        if (!$relist) throw new RuntimeException('Failed to prepare refunded item relist');
        $relist->bind_param('si', $active, $productId);
        $relist->execute();
        $relist->close();
    }

    $conversationId = (int)$row['conversation_id'];
    $sellerId = (int)$row['schedule_seller_id'];
    $buyerId = (int)$row['schedule_buyer_id'];
    if ($conversationId > 0 && $sellerId > 0 && $buyerId > 0) {
        $isLateRefund = in_array(($row['refund_reason'] ?? ''), ['late_payment', 'completion_conflict'], true);
        insert_confirm_chat_message(
            $conn,
            $conversationId,
            $isLateRefund ? $buyerId : $sellerId,
            $isLateRefund ? $sellerId : $buyerId,
            $isLateRefund
                ? 'The electronic payment finished after the deadline and was refunded.'
                : 'The seller issued a full electronic payment refund.',
            [
                'type' => 'payment_refunded',
                'electronic_payment_id' => $electronicPaymentId,
                'scheduled_request_id' => (int)$row['scheduled_request_id'],
                'inventory_product_id' => $productId,
                'payment_amount_cents' => (int)$row['amount_cents'],
                'payment_status' => 'refunded',
                'relisted' => (int)($row['refund_relist'] ?? 0) === 1,
                'refund_reason' => $row['refund_reason'] ?? null,
            ]
        );
    }
    return true;
}
