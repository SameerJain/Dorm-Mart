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
            spr.request_id,
            spr.status,
            spr.buyer_user_id,
            spr.seller_user_id,
            spr.verification_code,
            spr.inventory_product_id,
            spr.conversation_id,
            spr.meet_location,
            spr.meeting_at,
            spr.negotiated_price,
            spr.is_trade,
            spr.trade_item_description,
            spr.snapshot_price_nego,
            spr.snapshot_trades,
            spr.snapshot_meet_location,
            spr.payment_option,
            spr.payment_amount_cents,
            spr.payment_mode,
            spr.payment_fallback_at,
            inv.title AS item_title,
            inv.photos AS item_photos
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
    
    // Update item status based on scheduled purchase status
    if ($inventoryProductId > 0) {
        if ($nextStatus === 'accepted') {
            // When accepted, restore inventory to snapshot values captured at scheduling time
            // This ensures buyer gets the item as it was when scheduled, even if seller changed settings
            // Example: If item was price negotiable when scheduled but seller removed that later,
            // the accepted purchase still honors the negotiated price
            
            // Get snapshot values with fallback to current inventory values if snapshots are missing
            // (shouldn't happen, but provides safety)
            $snapshotPriceNego = isset($row['snapshot_price_nego']) ? ((int)$row['snapshot_price_nego'] === 1) : null;
            $snapshotTrades = isset($row['snapshot_trades']) ? ((int)$row['snapshot_trades'] === 1) : null;
            $snapshotMeetLocation = isset($row['snapshot_meet_location']) ? trim((string)$row['snapshot_meet_location']) : null;
            $negotiatedPrice = isset($row['negotiated_price']) && $row['negotiated_price'] !== null 
                ? (float)$row['negotiated_price'] : null;
            
            // If snapshot values are missing, fetch current inventory values as fallback
            // This should never happen, but provides safety
            if ($snapshotPriceNego === null || $snapshotTrades === null) {
                // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
                $fallbackStmt = $conn->prepare('SELECT price_nego, trades, item_location FROM INVENTORY WHERE product_id = ? LIMIT 1');
                if ($fallbackStmt) {
                    $fallbackStmt->bind_param('i', $inventoryProductId);
                    $fallbackStmt->execute();
                    $fallbackRes = $fallbackStmt->get_result();
                    $fallbackRow = $fallbackRes ? $fallbackRes->fetch_assoc() : null;
                    $fallbackStmt->close();
                    
                    if ($fallbackRow) {
                        if ($snapshotPriceNego === null) {
                            $snapshotPriceNego = isset($fallbackRow['price_nego']) ? ((int)$fallbackRow['price_nego'] === 1) : false;
                        }
                        if ($snapshotTrades === null) {
                            $snapshotTrades = isset($fallbackRow['trades']) ? ((int)$fallbackRow['trades'] === 1) : false;
                        }
                        if ($snapshotMeetLocation === null) {
                            $snapshotMeetLocation = isset($fallbackRow['item_location']) ? trim((string)$fallbackRow['item_location']) : null;
                        }
                        error_log('Warning: Using fallback inventory values for scheduled purchase ' . $requestId);
                    }
                }
            }
            
            // Ensure we have boolean values (default to false if still null)
            $snapshotPriceNego = $snapshotPriceNego !== null ? $snapshotPriceNego : false;
            $snapshotTrades = $snapshotTrades !== null ? $snapshotTrades : false;
            
            // Build update query to forcefully set snapshot values
            $updateFields = ['item_status = ?'];
            $updateParams = ['Pending'];
            $updateTypes = 's';
            
            // Forcefully update price_nego to snapshot value
            $updateFields[] = 'price_nego = ?';
            $updateParams[] = $snapshotPriceNego ? 1 : 0;
            $updateTypes .= 'i';
            
            // Forcefully update trades to snapshot value
            $updateFields[] = 'trades = ?';
            $updateParams[] = $snapshotTrades ? 1 : 0;
            $updateTypes .= 'i';
            
            // Forcefully update item_location to snapshot value if it exists
            if ($snapshotMeetLocation !== null && $snapshotMeetLocation !== '') {
                $updateFields[] = 'item_location = ?';
                $updateParams[] = $snapshotMeetLocation;
                $updateTypes .= 's';
            }
            
            // Update listing_price if negotiated_price is provided AND item was price negotiable when scheduled
            // This ensures we only update price for items that were negotiable at the time of scheduling
            // Allow 0 as a valid price (free item)
            if ($negotiatedPrice !== null && $negotiatedPrice >= 0 && $snapshotPriceNego) {
                $updateFields[] = 'listing_price = ?';
                $updateParams[] = $negotiatedPrice;
                $updateTypes .= 'd';
            }
            
            // Build WHERE clause parameters
            $updateParams[] = $inventoryProductId;
            $updateParams[] = 'Sold';
            $updateTypes .= 'is';
            
            // Only update if item is not already 'Sold' (prevents overwriting completed transactions)
            $updateSql = 'UPDATE INVENTORY SET ' . implode(', ', $updateFields) . ' WHERE product_id = ? AND item_status != ?';
            // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
            $itemStatusStmt = $conn->prepare($updateSql);
            if ($itemStatusStmt) {
                $itemStatusStmt->bind_param($updateTypes, ...$updateParams);
                if (!$itemStatusStmt->execute()) {
                    $error = $itemStatusStmt->error;
                    error_log('Failed to update inventory for scheduled purchase ' . $requestId . ': ' . $error);
                    // Don't fail the acceptance, but log the error
                }
                $itemStatusStmt->close();
            } else {
                error_log('Failed to prepare inventory update statement for scheduled purchase ' . $requestId);
            }
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
            // When declined, revert item status to "Active" only if no other accepted purchases exist.
            $hasOtherAccepted = scheduled_purchase_has_active_accepted($conn, $inventoryProductId, $requestId);

            // Only set back to Active if no other accepted scheduled purchases exist
            if (!$hasOtherAccepted) {
                // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
                $itemStatusStmt = $conn->prepare('UPDATE INVENTORY SET item_status = ? WHERE product_id = ? AND item_status = ?');
                if ($itemStatusStmt) {
                    $activeStatus = 'Active';
                    $pendingStatus = 'Pending';
                    $itemStatusStmt->bind_param('sis', $activeStatus, $inventoryProductId, $pendingStatus);
                    $itemStatusStmt->execute();
                    $itemStatusStmt->close();
                }
            }
        }
    }
    
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

            scheduled_purchase_insert_chat_message($conn, $conversationId, $msgSenderId, $msgReceiverId, $messageContent, [
                'type' => $action === 'accept' ? 'schedule_accepted' : 'schedule_denied',
                'request_id' => $requestId,
            ]);

            // If purchase was accepted, send a separate "Next Steps" message
            // Note: This message does NOT increment unread count (no notification for either party)
            if ($action === 'accept') {
                $usesPayment = ($row['payment_option'] ?? 'manual') === 'stripe' && empty($row['payment_fallback_at']);
                $nextStepsContent = $usesPayment
                    ? 'Built-in payment opens at the scheduled time for 30 minutes. A successful payment completes the purchase automatically.'
                    : 'Meet in-person at this agreed upon time and location to complete the exchange. Remember to use the verification code to verify identities! Once the exchange is done, the seller will send the Confirm Purchase form.';
                scheduled_purchase_insert_chat_message($conn, $conversationId, $msgSenderId, $msgReceiverId, $nextStepsContent, [
                    'type' => 'next_steps',
                    'request_id' => $requestId,
                ], false);
            }
        }
    }

    $meetingAtIso = scheduled_purchase_utc_atom($row['meeting_at'] ?? null);
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

