<?php

declare(strict_types=1);

require_once __DIR__ . '/../auth/auth_handle.php';
require_once __DIR__ . '/../database/db_connect.php';
require_once __DIR__ . '/../helpers/api_bootstrap.php';
require_once __DIR__ . '/../helpers/request.php';
require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/../helpers/notifications.php';

init_json_endpoint('POST');

try {
    $userId = require_login();

    $payload = json_request_body_or_error();
    require_csrf_token($payload['csrf_token'] ?? null);

    $requestId = isset($payload['request_id']) ? (int)$payload['request_id'] : 0;

    if ($requestId <= 0) {
        json_response(['success' => false, 'error' => 'Invalid request'], 400);
    }

    $conn = db();
    $conn->set_charset('utf8mb4');

    // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
    $selectSql = <<<SQL
        SELECT
            spr.request_id,
            spr.status,
            spr.seller_user_id,
            spr.buyer_user_id,
            spr.conversation_id,
            spr.inventory_product_id,
            inv.title AS item_title,
            inv.photos AS item_photos
        FROM scheduled_purchase_requests spr
        INNER JOIN INVENTORY inv ON inv.product_id = spr.inventory_product_id
        WHERE spr.request_id = ?
        LIMIT 1
    SQL;

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

    $sellerId = (int)$row['seller_user_id'];
    $buyerId = (int)$row['buyer_user_id'];
    
    // Allow both seller and buyer to cancel
    if ($userId !== $sellerId && $userId !== $buyerId) {
        json_response(['success' => false, 'error' => 'Not authorized to cancel this request'], 403);
    }

    // Prevent invalid cancellation states
    $currentStatus = (string)$row['status'];
    if ($currentStatus === 'cancelled') {
        json_response(['success' => false, 'error' => 'Request is already cancelled'], 409);
    }

    // Cannot cancel a declined request (buyer already rejected it)
    if ($currentStatus === 'declined') {
        json_response(['success' => false, 'error' => 'Cannot cancel a declined request'], 409);
    }

    // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
    $updateStmt = $conn->prepare('UPDATE scheduled_purchase_requests SET status = ?, canceled_by_user_id = ? WHERE request_id = ? LIMIT 1');
    if (!$updateStmt) {
        throw new RuntimeException('Failed to prepare update');
    }
    $status = 'cancelled';
    $updateStmt->bind_param('sii', $status, $userId, $requestId);
    $updateStmt->execute();
    $updateStmt->close();
    notification_cancel_schedule($conn, $requestId);
    
    // Revert item status to "Active" when cancelled, but only if no other accepted purchases exist
    // This ensures item becomes available again only when truly free of all accepted scheduled purchases
    $inventoryProductId = (int)$row['inventory_product_id'];
    if ($inventoryProductId > 0) {
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
                if ($itemStatusStmt->affected_rows > 0) {
                    notification_for_wishlist($conn, $inventoryProductId, [
                        'type' => 'item_back_on_sale', 'title' => (string)$row['item_title'],
                        'message' => $row['item_title'] . ' is back on sale.',
                        'image_url' => notification_first_image($row['item_photos'] ?? null),
                        'severity' => 'success', 'destination' => '/app/viewProduct/' . $inventoryProductId,
                        'idempotency_key' => 'back-on-sale-cancel-' . $requestId,
                    ]);
                }
                $itemStatusStmt->close();
            }
        }
    }
    
    // Create special message in chat
    $conversationId = isset($row['conversation_id']) ? (int)$row['conversation_id'] : 0;
    if ($conversationId > 0) {
        $cancellerDisplayName = scheduled_purchase_user_display_name($conn, $userId);
        $messageContent = $cancellerDisplayName . ' has cancelled the scheduled purchase.';

        $convRow = scheduled_purchase_conversation_participants($conn, $conversationId);
        if ($convRow) {
            $msgSenderId = $userId;
            $msgReceiverId = ($convRow['user1_id'] == $userId) ? (int)$convRow['user2_id'] : (int)$convRow['user1_id'];

            scheduled_purchase_insert_chat_message($conn, $conversationId, $msgSenderId, $msgReceiverId, $messageContent, [
                'type' => 'schedule_cancelled',
                'request_id' => $requestId,
            ]);
        }
    }

    $conn->begin_transaction();

    $response = [
        'success' => true,
        'data' => [
            'request_id' => $requestId,
            'status' => 'cancelled',
        ],
    ];

    $conn->commit();
    json_response($response);
} catch (Throwable $e) {
    if (isset($conn) && $conn instanceof mysqli) { try { $conn->rollback(); } catch (Throwable $_) {} }
    error_log('scheduled-purchase cancel error: ' . $e->getMessage());
    json_response(['success' => false, 'error' => 'Internal server error'], 500);
}
