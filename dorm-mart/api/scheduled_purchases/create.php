<?php

declare(strict_types=1);

require_once __DIR__ . '/../auth/auth_handle.php';
require_once __DIR__ . '/../database/db_connect.php';
require_once __DIR__ . '/../helpers/api_bootstrap.php';
require_once __DIR__ . '/../helpers/request.php';
require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/proposal.php';
require_once __DIR__ . '/../payments/helpers.php';
require_once __DIR__ . '/../helpers/notifications.php';
require_once __DIR__ . '/../helpers/moderation.php';

init_json_endpoint('POST');

try {
    $sellerId = require_login();

    $payload = json_request_body_or_error();
    require_csrf_token($payload['csrf_token'] ?? null);

    $read = scheduled_purchase_read_proposal($payload, new DateTimeImmutable('now', new DateTimeZone('UTC')), dm_payments_enabled());
    if (!$read['ok']) {
        json_response(['success' => false, 'error' => $read['error']], $read['status']);
    }
    $proposal = $read['proposal'];
    [
        'inventory_id' => $inventoryId, 'conversation_id' => $conversationId, 'meet_location' => $meetLocation,
        'meeting_at' => $meetingAt, 'description' => $description, 'negotiated_price' => $negotiatedPrice,
        'is_trade' => $isTrade, 'trade_item_description' => $tradeItemDescription,
        'payment_option' => $paymentOption, 'payment_amount_cents' => $paymentAmountCents,
    ] = $proposal;
    $meetingAtDb = $meetingAt->format('Y-m-d H:i:s');

    $conn = db();
    $conn->set_charset('utf8mb4');

    // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
    $itemStmt = $conn->prepare('SELECT product_id, title, seller_id, price_nego, trades, item_location, listing_price, photos FROM INVENTORY WHERE product_id = ? LIMIT 1');
    if (!$itemStmt) {
        throw new RuntimeException('Failed to prepare inventory query');
    }
    $itemStmt->bind_param('i', $inventoryId);
    $itemStmt->execute();
    $itemRes = $itemStmt->get_result();
    $itemRow = $itemRes ? $itemRes->fetch_assoc() : null;
    $itemStmt->close();

    if (!$itemRow || (int)$itemRow['seller_id'] !== $sellerId) {
        json_response(['success' => false, 'error' => 'You can only schedule for your own listings'], 403);
    }

    // Snapshot mechanism: Capture item settings at scheduling time
    // This ensures that if seller changes item settings (price negotiable, trades, location) 
    // after scheduling, the scheduled purchase still uses the original settings when accepted
    $snapshotPriceNego = isset($itemRow['price_nego']) ? ((int)$itemRow['price_nego'] === 1) : false;
    $snapshotTrades = isset($itemRow['trades']) ? ((int)$itemRow['trades'] === 1) : false;
    $snapshotMeetLocation = isset($itemRow['item_location']) ? trim((string)$itemRow['item_location']) : null;

    // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
    $convStmt = $conn->prepare('SELECT conv_id, product_id, user1_id, user2_id, user1_deleted, user2_deleted FROM conversations WHERE conv_id = ? LIMIT 1');
    if (!$convStmt) {
        throw new RuntimeException('Failed to prepare conversation query');
    }
    $convStmt->bind_param('i', $conversationId);
    $convStmt->execute();
    $convRes = $convStmt->get_result();
    $convRow = $convRes ? $convRes->fetch_assoc() : null;
    $convStmt->close();

    if (!$convRow) {
        json_response(['success' => false, 'error' => 'Conversation not found'], 404);
    }
    // Confirm Purchase looks the schedule up through the chat's own listing, so a
    // schedule filed under another listing's chat could never be completed.
    if ((int)($convRow['product_id'] ?? 0) !== $inventoryId) {
        json_response(['success' => false, 'error' => 'This conversation is about a different listing'], 400);
    }

    $buyerId = 0;
    if ((int)$convRow['user1_id'] === $sellerId) {
        if ((int)$convRow['user1_deleted'] === 1) {
            json_response(['success' => false, 'error' => 'Conversation is no longer available'], 403);
        }
        $buyerId = (int)$convRow['user2_id'];
    } elseif ((int)$convRow['user2_id'] === $sellerId) {
        if ((int)$convRow['user2_deleted'] === 1) {
            json_response(['success' => false, 'error' => 'Conversation is no longer available'], 403);
        }
        $buyerId = (int)$convRow['user1_id'];
    } else {
        json_response(['success' => false, 'error' => 'You do not have access to this conversation'], 403);
    }

    if ($buyerId <= 0) {
        json_response(['success' => false, 'error' => 'Could not determine buyer'], 400);
    }

    // Ensure buyer is not the seller
    if ($buyerId === $sellerId) {
        json_response(['success' => false, 'error' => 'Cannot schedule with yourself'], 400);
    }
    if (moderation_user_is_banned($conn, $buyerId)) {
        json_response(['success' => false, 'error' => 'This user is no longer available'], 403);
    }

    // Check the listing's terms before any further lookups.
    $termsError = scheduled_purchase_terms_error($proposal, $snapshotPriceNego, $snapshotTrades);
    if ($termsError !== null) {
        json_response(['success' => false, 'error' => $termsError], 400);
    }

    $paymentMode = null;
    if ($paymentOption === 'stripe') {
        $eligibility = payment_schedule_eligibility($conn, $sellerId, $buyerId);
        if (empty($eligibility['eligible'])) {
            json_response(['success' => false, 'error' => $eligibility['reason'] ?? 'Built-in payment is unavailable'], 409);
        }
        $paymentMode = (string)$eligibility['mode'];
    }

    // Generate unique 4-character verification code for buyer-seller meetup confirmation
    $verificationCode = generate_unique_code($conn);

    // The chat UI hides the schedule button while a request is open, but only
    // this locked check makes that rule hold: a double-clicked submit or a second
    // tab would otherwise create duplicate requests and duplicate chat cards.
    // respond.php takes the same INVENTORY row lock before accepting.
    $conn->begin_transaction();
    $inventoryLock = $conn->prepare('SELECT item_status, sold FROM INVENTORY WHERE product_id = ? LIMIT 1 FOR UPDATE');
    if (!$inventoryLock) {
        throw new RuntimeException('Failed to prepare inventory lock');
    }
    $inventoryLock->bind_param('i', $inventoryId);
    $inventoryLock->execute();
    $lockedItem = $inventoryLock->get_result()->fetch_assoc();
    $inventoryLock->close();
    if (!$lockedItem || (int)$lockedItem['sold'] === 1 || $lockedItem['item_status'] === 'Sold') {
        $conn->rollback();
        json_response(['success' => false, 'error' => 'This item has already been sold'], 409);
    }
    if ($lockedItem['item_status'] === 'Draft') {
        $conn->rollback();
        json_response(['success' => false, 'error' => 'Publish this listing before scheduling a purchase'], 409);
    }
    if (scheduled_purchase_has_open_request($conn, $inventoryId)) {
        $conn->rollback();
        json_response(['success' => false, 'error' => 'This item already has an active scheduled purchase'], 409);
    }

    // Empty optional text is stored as NULL.
    $columns = [
        'inventory_product_id' => ['i', $inventoryId], 'seller_user_id' => ['i', $sellerId],
        'buyer_user_id' => ['i', $buyerId], 'conversation_id' => ['i', $conversationId],
        'meet_location' => ['s', $meetLocation], 'meeting_at' => ['s', $meetingAtDb],
        'verification_code' => ['s', $verificationCode],
        'description' => ['s', $description !== '' ? $description : null],
        'negotiated_price' => ['d', $negotiatedPrice], 'is_trade' => ['i', $isTrade ? 1 : 0],
        'trade_item_description' => ['s', ($tradeItemDescription ?? '') !== '' ? $tradeItemDescription : null],
        'snapshot_price_nego' => ['i', $snapshotPriceNego ? 1 : 0], 'snapshot_trades' => ['i', $snapshotTrades ? 1 : 0],
        'snapshot_meet_location' => ['s', ($snapshotMeetLocation ?? '') !== '' ? $snapshotMeetLocation : null],
    ];
    // The payment columns exist only when the payments schema feature is enabled.
    if (dm_payments_enabled()) {
        $columns += [
            'payment_option' => ['s', $paymentOption], 'payment_amount_cents' => ['i', $paymentAmountCents],
            'payment_mode' => ['s', $paymentMode],
        ];
    }
    $stmt = $conn->prepare(sprintf(
        'INSERT INTO scheduled_purchase_requests (%s) VALUES (%s)',
        implode(', ', array_keys($columns)),
        implode(', ', array_fill(0, count($columns), '?'))
    ));
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare insert');
    }
    $stmt->bind_param(implode('', array_column($columns, 0)), ...array_column($columns, 1));
    
    if (!$stmt->execute()) {
        $error = $stmt->error;
        $stmt->close();
        error_log('Failed to execute scheduled purchase insert: ' . $error);
        throw new RuntimeException('Failed to create scheduled purchase: ' . $error);
    }
    $requestId = $stmt->insert_id;
    $stmt->close();
    
    // Create special message in chat
    if ($conversationId > 0) {
        $sellerDisplayName = scheduled_purchase_user_display_name($conn, $sellerId);
        $messageContent = $sellerDisplayName . ' has scheduled a purchase. Please Accept or Deny.';
        $listingPrice = isset($itemRow['listing_price']) ? (float)$itemRow['listing_price'] : null;

        chat_insert_system_message($conn, $conversationId, $sellerId, $buyerId, $messageContent, [
            'type' => 'schedule_request',
            'request_id' => $requestId,
            'inventory_product_id' => $inventoryId,
            'product_id' => $inventoryId,
            'product_title' => $itemRow['title'] ?? '',
            'meeting_at' => $meetingAt->format(DateTime::ATOM),
            'meet_location' => $meetLocation,
            'original_meet_location' => $snapshotMeetLocation,
            'verification_code' => $verificationCode,
            'description' => $description,
            'negotiated_price' => $negotiatedPrice,
            'listing_price' => $listingPrice,
            'is_trade' => $isTrade,
            'trade_item_description' => $tradeItemDescription,
            'payment_option' => $paymentOption,
            'payment_amount_cents' => $paymentAmountCents,
            'payment_mode' => $paymentMode,
        ]);
    }

    // The request quietly expires if the buyer never answers, and the chat card
    // alone is easy to miss, so prompt them in notifications too.
    notification_insert($conn, [
        'recipient_user_id' => $buyerId, 'type' => 'schedule_request',
        'product_id' => $inventoryId, 'scheduled_request_id' => $requestId,
        'title' => (string)($itemRow['title'] ?? 'Scheduled purchase'),
        'message' => scheduled_purchase_user_display_name($conn, $sellerId)
            . ' scheduled a meetup at ' . $meetLocation . '. Accept or decline it in chat before it expires.',
        'image_url' => notification_first_image($itemRow['photos'] ?? null), 'severity' => 'warning',
        'destination' => '/app/chat?conv=' . $conversationId,
        'idempotency_key' => 'schedule-request-' . $requestId,
    ]);

    $conn->commit();

    // XSS PROTECTION: Escape user-generated content before returning in JSON
    $response = [
        'success' => true,
        'data' => [
            'request_id' => $requestId,
            'inventory_product_id' => $inventoryId,
            'conversation_id' => $conversationId,
            'seller_user_id' => $sellerId,
            'buyer_user_id' => $buyerId,
            'meet_location' => $meetLocation,
            'meeting_at' => $meetingAt->format(DateTime::ATOM),
            'verification_code' => $verificationCode,
            'status' => 'pending',
            'payment_option' => $paymentOption,
            'payment_amount_cents' => $paymentAmountCents,
            'payment_mode' => $paymentMode,
        ],
    ];

    json_response($response);
} catch (Throwable $e) {
    if (isset($conn) && $conn instanceof mysqli) { try { $conn->rollback(); } catch (Throwable $_) {} }
    error_log('scheduled-purchase create error: ' . $e->getMessage());
    json_response(['success' => false, 'error' => 'Internal server error'], 500);
}

function generate_unique_code(mysqli $conn): string
{
    $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    $length = strlen($alphabet) - 1;

    // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
    $checkStmt = $conn->prepare('SELECT request_id FROM scheduled_purchase_requests WHERE verification_code = ? LIMIT 1');
    if (!$checkStmt) {
        throw new RuntimeException('Failed to prepare code check');
    }

    try {
        while (true) {
            $code = '';
            for ($i = 0; $i < 4; $i++) {
                $code .= $alphabet[random_int(0, $length)];
            }

            $checkStmt->bind_param('s', $code);
            $checkStmt->execute();
            $res = $checkStmt->get_result();
            if ($res && $res->num_rows === 0) {
                return $code;
            }
        }
    } finally {
        $checkStmt->close();
    }
}
