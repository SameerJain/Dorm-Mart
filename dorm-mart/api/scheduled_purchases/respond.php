<?php

declare(strict_types=1);

require_once __DIR__ . '/../auth/auth_handle.php';
require_once __DIR__ . '/../database/db_connect.php';
require_once __DIR__ . '/../helpers/api_bootstrap.php';
require_once __DIR__ . '/../helpers/request.php';
require_once __DIR__ . '/expire_stale.php';
require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/../helpers/notifications.php';
require_once __DIR__ . '/../payments/helpers.php';

init_json_endpoint('POST');

try {
    $buyerId = require_login();

    $payload = json_request_body_or_error();
    require_csrf_token($payload['csrf_token'] ?? null);

    $requestId = request_int($payload, 'request_id');
    $action = isset($payload['action']) && is_string($payload['action'])
        ? strtolower(trim($payload['action']))
        : '';

    if ($requestId <= 0 || ($action !== 'accept' && $action !== 'decline')) {
        json_response(['success' => false, 'error' => 'Invalid request'], 400);
    }

    $conn = db();
    $conn->set_charset('utf8mb4');

    expire_stale_requests($conn);
    $conn->begin_transaction();

    $selectSql = <<<SQL
        SELECT
            spr.*,
            inv.title AS item_title,
            inv.photos AS item_photos,
            inv.item_status AS item_status,
            inv.sold AS item_sold
        FROM scheduled_purchase_requests spr
        INNER JOIN INVENTORY inv ON inv.product_id = spr.inventory_product_id
        WHERE spr.request_id = ?
        LIMIT 1
        FOR UPDATE
    SQL;

    // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
    $selectStmt = $conn->prepare($selectSql);
    if (!$selectStmt) {
        throw new RuntimeException('Failed to prepare select');
    }
    $selectStmt->bind_param('i', $requestId);
    $selectStmt->execute();
    $res = $selectStmt->get_result();
    $row = $res ? $res->fetch_assoc() : null;
    $selectStmt->close();

    if (!$row) {
        json_response(['success' => false, 'error' => 'Request not found'], 404);
    }

    if ((int)$row['buyer_user_id'] !== $buyerId) {
        json_response(['success' => false, 'error' => 'Not authorized to respond to this request'], 403);
    }

    if ($row['status'] !== 'pending') {
        json_response(['success' => false, 'error' => 'Request has already been handled'], 409);
    }

    // Lock the listing so two buyers cannot accept schedules for it concurrently.
    $inventoryLock = $conn->prepare('SELECT product_id FROM INVENTORY WHERE product_id = ? LIMIT 1 FOR UPDATE');
    if (!$inventoryLock) throw new RuntimeException('Failed to prepare inventory lock');
    $inventoryProductId = (int)$row['inventory_product_id'];
    $inventoryLock->bind_param('i', $inventoryProductId);
    $inventoryLock->execute();
    $inventoryLock->store_result();
    $inventoryLock->close();

    // Prevent double-booking against active accepted schedules only.
    // Accepted schedules whose latest confirmation was unsuccessful are done.
    if ($action === 'accept' && ((int)$row['item_sold'] === 1 || $row['item_status'] === 'Sold')) {
        json_response(['success' => false, 'error' => 'This item has already been sold'], 409);
    }
    if ($action === 'accept' && $row['item_status'] === 'Draft') {
        json_response(['success' => false, 'error' => 'This listing is no longer available'], 409);
    }
    if ($action === 'accept' && $inventoryProductId > 0) {
        if (scheduled_purchase_has_active_accepted($conn, $inventoryProductId, $requestId)) {
            json_response(['success' => false, 'error' => 'This item has already been accepted by another buyer'], 409);
        }
    }

    $nextStatus = $action === 'accept' ? 'accepted' : 'declined';
    // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
    $updateStmt = $conn->prepare('UPDATE scheduled_purchase_requests SET status = ?, buyer_response_at = NOW() WHERE request_id = ? LIMIT 1');
    if (!$updateStmt) {
        throw new RuntimeException('Failed to prepare update');
    }
    $updateStmt->bind_param('si', $nextStatus, $requestId);
    $updateStmt->execute();
    $updateStmt->close();
    
    // Update the listing to match the answer.
    if ($nextStatus === 'accepted') {
        // Hold the listing on the terms it had when the seller scheduled it.
        scheduled_purchase_reserve_listing($conn, $row);
        $title = (string)($row['item_title'] ?? 'Item');
        $image = notification_first_image($row['item_photos'] ?? null);
        notification_for_wishlist($conn, $inventoryProductId, [
            'type' => 'item_pending', 'title' => $title,
            'message' => $title . ' is not currently for sale because another purchase is scheduled.',
            'image_url' => $image, 'severity' => 'warning', 'destination' => null,
            'idempotency_key' => 'pending-schedule-' . $requestId,
        ], $buyerId);
        $meeting = new DateTimeImmutable((string)$row['meeting_at'], new DateTimeZone('UTC'));
        $now = new DateTimeImmutable('now', new DateTimeZone('UTC'));
        foreach ([['24h', '-24 hours', 'info'], ['1h', '-1 hour', 'urgent']] as [$label, $offset, $severity]) {
            $availableAt = $meeting->modify($offset);
            if ($availableAt <= $now) continue;

            notification_insert($conn, [
                'recipient_user_id' => $buyerId, 'type' => 'scheduled_purchase_' . $label,
                'product_id' => $inventoryProductId, 'scheduled_request_id' => $requestId,
                'title' => $title, 'message' => 'Your scheduled purchase is coming up in ' . ($label === '24h' ? '24 hours.' : '1 hour.'),
                'image_url' => $image, 'severity' => $severity, 'destination' => '/app/seller-dashboard/ongoing-purchases',
                'idempotency_key' => 'schedule-' . $label . '-' . $requestId,
                'available_at' => $availableAt->format('Y-m-d H:i:s'),
            ]);
        }
        notification_insert($conn, [
            'recipient_user_id' => (int)$row['seller_user_id'], 'type' => 'confirm_purchase_reminder',
            'product_id' => $inventoryProductId, 'scheduled_request_id' => $requestId,
            'title' => $title, 'message' => 'Please complete the Confirm Purchase form for this scheduled purchase.',
            'image_url' => $image, 'severity' => 'warning', 'destination' => '/app/chat?conv=' . (int)$row['conversation_id'],
            'idempotency_key' => 'confirm-reminder-' . $requestId,
            'available_at' => $meeting->modify('+8 hours')->format('Y-m-d H:i:s'),
        ]);

        if (($row['payment_option'] ?? 'manual') === 'stripe') {
            $eligibility = payment_schedule_eligibility(
                $conn,
                (int)$row['seller_user_id'],
                $buyerId
            );
            if (empty($eligibility['eligible']) || ($eligibility['mode'] ?? null) !== ($row['payment_mode'] ?? null)) {
                payment_apply_fallback($conn, $row, 'seller_account_unavailable');
                $row['payment_fallback_at'] = gmdate('Y-m-d H:i:s');
            }
        }
    } elseif ($nextStatus === 'declined') {
        notification_cancel_schedule($conn, $requestId);
        scheduled_purchase_release_listing($conn, $inventoryProductId, $requestId, 'decline');
    }
    
    // The buyer has answered: drop their prompt, and tell the seller, who is
    // otherwise left checking the chat to learn whether the meetup is on.
    notification_clear_prompt($conn, $requestId, 'schedule_request');
    $accepted = $action === 'accept';
    $respondedConvId = (int)($row['conversation_id'] ?? 0);
    notification_insert($conn, [
        'recipient_user_id' => (int)$row['seller_user_id'],
        'type' => $accepted ? 'schedule_accepted' : 'schedule_declined',
        'product_id' => $inventoryProductId > 0 ? $inventoryProductId : null,
        'scheduled_request_id' => $requestId,
        'title' => (string)($row['item_title'] ?? 'Scheduled purchase'),
        'message' => scheduled_purchase_user_display_name($conn, $buyerId)
            . ($accepted
                ? ' accepted your scheduled meetup at ' . $row['meet_location'] . '.'
                : ' declined your scheduled meetup. You can propose a new time in chat.'),
        'image_url' => notification_first_image($row['item_photos'] ?? null),
        'severity' => $accepted ? 'success' : 'warning',
        'destination' => $respondedConvId > 0 ? '/app/chat?conv=' . $respondedConvId : '/app/seller-dashboard/ongoing-purchases',
        'idempotency_key' => 'schedule-response-' . $requestId,
    ]);

    // Create special message in chat
    $conversationId = isset($row['conversation_id']) ? (int)$row['conversation_id'] : 0;
    if ($conversationId > 0) {
        $buyerDisplayName = scheduled_purchase_user_display_name($conn, $buyerId);
        $actionText = $action === 'accept' ? 'accepted' : 'denied';
        $messageContent = $buyerDisplayName . ' has ' . $actionText . ' the scheduled purchase.';

        $convRow = scheduled_purchase_conversation_participants($conn, $conversationId);
        if ($convRow) {
            $msgSenderId = $buyerId;
            $msgReceiverId = ($convRow['user1_id'] == $buyerId) ? (int)$convRow['user2_id'] : (int)$convRow['user1_id'];

            chat_insert_system_message($conn, $conversationId, $msgSenderId, $msgReceiverId, $messageContent, [
                'type' => $action === 'accept' ? 'schedule_accepted' : 'schedule_denied',
                'request_id' => $requestId,
            ]);

            // If purchase was accepted, send a separate "Next Steps" message
            // Note: This message does NOT increment unread count (no notification for either party)
            if ($action === 'accept') {
                $usesPayment = ($row['payment_option'] ?? 'manual') === 'stripe' && empty($row['payment_fallback_at']);
                $nextStepsContent = $usesPayment
                    ? 'Built-in payment opens at the scheduled time for 30 minutes. A successful payment completes the purchase automatically. Check the Ongoing Purchases page for the full meeting details.'
                    : 'Meet in-person at this agreed upon time and location to complete the exchange. Remember to use the verification code to verify identities! Once the exchange is done, the seller will send the Confirm Purchase form. Check the Ongoing Purchases page for the full meeting details, including contact info the seller has chosen to share.';
                chat_insert_system_message($conn, $conversationId, $msgSenderId, $msgReceiverId, $nextStepsContent, [
                    'type' => 'next_steps',
                    'request_id' => $requestId,
                ], false);
            }
        }
    }

    $meetingAtIso = dm_utc_atom($row['meeting_at'] ?? null);
    $responseAtIso = scheduled_purchase_now_utc_atom();

    // XSS PROTECTION: Escape user-generated content before returning in JSON
    $response = [
        'success' => true,
        'data' => [
            'request_id' => $requestId,
            'status' => $nextStatus,
            'verification_code' => (string)$row['verification_code'],
            'seller_user_id' => (int)$row['seller_user_id'],
            'buyer_user_id' => $buyerId,
            'inventory_product_id' => (int)$row['inventory_product_id'],
            'meet_location' => $row['meet_location'] ?? '',
            'meeting_at' => $meetingAtIso,
            'payment_option' => $row['payment_option'] ?? 'manual',
            'payment_amount_cents' => isset($row['payment_amount_cents']) ? (int)$row['payment_amount_cents'] : null,
            'payment_mode' => $row['payment_mode'] ?? null,
            'payment_fallback_at' => $row['payment_fallback_at'] ?? null,
            'buyer_response_at' => $responseAtIso,
            'item' => [
                'title' => $row['item_title'] ?? 'Untitled',
            ],
        ],
    ];

    $conn->commit();
    json_response($response);
} catch (Throwable $e) {
    if (isset($conn) && $conn instanceof mysqli) { try { $conn->rollback(); } catch (Throwable $_) {} }
    error_log('scheduled-purchase respond error: ' . $e->getMessage());
    json_response(['success' => false, 'error' => 'Internal server error'], 500);
}

