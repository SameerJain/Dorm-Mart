<?php

declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

function payment_complete_purchase_transaction(
    mysqli $conn,
    int $electronicPaymentId,
    DateTimeImmutable $succeededAt,
    ?string $stripeChargeId = null
): array {
    $stmt = $conn->prepare(
        'SELECT ep.*, spr.*, inv.title AS item_title
           FROM electronic_payments ep
           INNER JOIN scheduled_purchase_requests spr ON spr.request_id = ep.scheduled_request_id
           INNER JOIN INVENTORY inv ON inv.product_id = spr.inventory_product_id
          WHERE ep.electronic_payment_id = ?
          LIMIT 1
          FOR UPDATE'
    );
    if (!$stmt) throw new RuntimeException('Failed to prepare payment completion lookup');
    $stmt->bind_param('i', $electronicPaymentId);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    if (!$row) throw new RuntimeException('Electronic payment not found');

    $inventoryId = (int)$row['inventory_product_id'];
    $inventoryStmt = $conn->prepare('SELECT product_id, sold FROM INVENTORY WHERE product_id = ? LIMIT 1 FOR UPDATE');
    if (!$inventoryStmt) throw new RuntimeException('Failed to lock inventory for payment completion');
    $inventoryStmt->bind_param('i', $inventoryId);
    $inventoryStmt->execute();
    $inventoryRow = $inventoryStmt->get_result()->fetch_assoc();
    $inventoryStmt->close();
    if (!$inventoryRow) throw new RuntimeException('Inventory item not found');

    $scheduleId = (int)$row['scheduled_request_id'];
    $existingStmt = $conn->prepare(
        "SELECT confirm_request_id, electronic_payment_id
           FROM confirm_purchase_requests
          WHERE scheduled_request_id = ?
            AND is_successful = 1
            AND status IN ('buyer_accepted','auto_accepted','payment_completed')
          ORDER BY confirm_request_id DESC
          LIMIT 1
          FOR UPDATE"
    );
    if (!$existingStmt) throw new RuntimeException('Failed to prepare completed purchase lookup');
    $existingStmt->bind_param('i', $scheduleId);
    $existingStmt->execute();
    $existing = $existingStmt->get_result()->fetch_assoc();
    $existingStmt->close();
    if ($existing) {
        return [
            'completed' => (int)($existing['electronic_payment_id'] ?? 0) === $electronicPaymentId,
            'conflict' => (int)($existing['electronic_payment_id'] ?? 0) !== $electronicPaymentId,
            'confirm_request_id' => (int)$existing['confirm_request_id'],
        ];
    }

    $amountCents = (int)$row['amount_cents'];
    $finalPrice = $amountCents / 100;
    $snapshot = [
        'item_title' => (string)$row['item_title'],
        'buyer_id' => (int)$row['buyer_user_id'],
        'seller_id' => (int)$row['seller_user_id'],
        'meet_location' => $row['meet_location'],
        'meeting_at' => confirm_purchase_utc_atom($row['meeting_at']),
        'description' => $row['description'],
        'negotiated_price' => $finalPrice,
        'is_trade' => false,
        'payment_amount_cents' => $amountCents,
        'completion_source' => 'stripe',
    ];
    $snapshotJson = json_encode($snapshot, JSON_UNESCAPED_SLASHES);
    if ($snapshotJson === false) throw new RuntimeException('Failed to encode payment completion snapshot');

    $insert = $conn->prepare(
        "INSERT INTO confirm_purchase_requests
            (scheduled_request_id, inventory_product_id, seller_user_id, buyer_user_id, conversation_id,
             is_successful, final_price, status, completion_source, electronic_payment_id, expires_at,
             buyer_response_at, auto_processed_at, payload_snapshot)
         VALUES (?, ?, ?, ?, ?, 1, ?, 'payment_completed', 'stripe', ?, NOW(), ?, ?, ?)"
    );
    if (!$insert) throw new RuntimeException('Failed to prepare payment confirmation insert');
    $sellerId = (int)$row['seller_user_id'];
    $buyerId = (int)$row['buyer_user_id'];
    $conversationId = (int)$row['conversation_id'];
    $succeededDb = $succeededAt->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s');
    $insert->bind_param(
        'iiiiidisss',
        $scheduleId,
        $inventoryId,
        $sellerId,
        $buyerId,
        $conversationId,
        $finalPrice,
        $electronicPaymentId,
        $succeededDb,
        $succeededDb,
        $snapshotJson
    );
    $insert->execute();
    $confirmRequestId = (int)$insert->insert_id;
    $insert->close();

    $confirmRow = [
        'confirm_request_id' => $confirmRequestId,
        'scheduled_request_id' => $scheduleId,
        'inventory_product_id' => $inventoryId,
        'seller_user_id' => $sellerId,
        'buyer_user_id' => $buyerId,
        'conversation_id' => $conversationId,
        'is_successful' => 1,
        'final_price' => $finalPrice,
        'status' => 'payment_completed',
        'completion_source' => 'stripe',
        'electronic_payment_id' => $electronicPaymentId,
        'payload_snapshot' => $snapshotJson,
    ];

    complete_successful_purchase($conn, $confirmRow, [
        'confirm_request_id' => $confirmRequestId,
        'electronic_payment_id' => $electronicPaymentId,
        'is_successful' => true,
        'final_price' => $finalPrice,
        'completion_source' => 'stripe',
        'auto_accepted' => true,
    ]);

    if ($conversationId > 0) {
        insert_confirm_chat_message(
            $conn,
            $conversationId,
            $buyerId,
            $sellerId,
            'Electronic payment completed this purchase.',
            [
                'type' => 'payment_completed',
                'confirm_purchase_status' => 'payment_completed',
                'confirm_request_id' => $confirmRequestId,
                'scheduled_request_id' => $scheduleId,
                'electronic_payment_id' => $electronicPaymentId,
                'inventory_product_id' => $inventoryId,
                'product_title' => (string)$row['item_title'],
                'is_successful' => true,
                'final_price' => $finalPrice,
                'payment_amount_cents' => $amountCents,
                'payment_status' => 'succeeded',
                'completion_source' => 'stripe',
                'meeting_at' => confirm_purchase_utc_atom($row['meeting_at']),
            ]
        );
    }

    $paymentUpdate = $conn->prepare(
        "UPDATE electronic_payments
            SET status = CASE WHEN status = 'disputed' THEN 'disputed' ELSE 'succeeded' END,
                succeeded_at = ?, stripe_charge_id = COALESCE(?, stripe_charge_id), last_error_code = NULL
          WHERE electronic_payment_id = ?
            AND status NOT IN ('refund_pending','refund_failed','refunded','canceled')"
    );
    if (!$paymentUpdate) throw new RuntimeException('Failed to prepare completed payment update');
    $paymentUpdate->bind_param('ssi', $succeededDb, $stripeChargeId, $electronicPaymentId);
    $paymentUpdate->execute();
    $paymentUpdate->close();

    return ['completed' => true, 'conflict' => false, 'confirm_request_id' => $confirmRequestId];
}
