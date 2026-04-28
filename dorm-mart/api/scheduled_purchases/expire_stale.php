<?php

declare(strict_types=1);

/**
 * Lazy expiry: marks pending scheduled purchase requests as 'expired'
 * if the meeting time has passed or 3 days have elapsed since creation.
 *
 * Also inserts a chat message for each expired request so both parties
 * are notified in their conversation thread.
 *
 * Call expireStaleRequests($conn) before fetching list data.
 */
function expireStaleRequests(mysqli $conn): void
{
    $selectSql = <<<SQL
        SELECT
            spr.request_id,
            spr.conversation_id,
            spr.seller_user_id,
            spr.buyer_user_id,
            inv.title AS item_title
        FROM scheduled_purchase_requests spr
        LEFT JOIN INVENTORY inv ON inv.product_id = spr.inventory_product_id
        WHERE spr.status = 'pending'
          AND (spr.meeting_at < NOW() OR spr.created_at < NOW() - INTERVAL 3 DAY)
    SQL;

    $result = $conn->query($selectSql);
    if (!$result || $result->num_rows === 0) {
        return;
    }

    $rows = [];
    while ($row = $result->fetch_assoc()) {
        $rows[] = $row;
    }
    $result->free();

    $updateSql = <<<SQL
        UPDATE scheduled_purchase_requests
        SET status = 'expired', buyer_response_at = NOW()
        WHERE status = 'pending'
          AND (meeting_at < NOW() OR created_at < NOW() - INTERVAL 3 DAY)
    SQL;
    $conn->query($updateSql);

    foreach ($rows as $row) {
        $conversationId = isset($row['conversation_id']) ? (int)$row['conversation_id'] : 0;
        if ($conversationId <= 0) {
            continue;
        }

        $requestId = (int)$row['request_id'];
        $sellerId = (int)$row['seller_user_id'];
        $buyerId = (int)$row['buyer_user_id'];
        $itemTitle = $row['item_title'] ?? 'an item';

        $nameStmt = $conn->prepare('SELECT user_id, first_name, last_name FROM user_accounts WHERE user_id IN (?, ?) LIMIT 2');
        if (!$nameStmt) {
            continue;
        }
        $nameStmt->bind_param('ii', $sellerId, $buyerId);
        $nameStmt->execute();
        $nameRes = $nameStmt->get_result();
        $names = [];
        while ($nameRow = $nameRes->fetch_assoc()) {
            $id = (int)$nameRow['user_id'];
            $full = trim((string)($nameRow['first_name'] ?? '') . ' ' . (string)($nameRow['last_name'] ?? ''));
            $names[$id] = $full !== '' ? $full : ('User ' . $id);
        }
        $nameStmt->close();

        $senderName = 'System';
        $receiverName = $names[$buyerId] ?? ('User ' . $buyerId);
        $messageContent = sprintf(
            'The scheduled purchase for %s has expired because no response was received in time.',
            $itemTitle
        );

        $metadata = json_encode([
            'type' => 'schedule_expired',
            'request_id' => $requestId,
        ], JSON_UNESCAPED_SLASHES);

        $msgStmt = $conn->prepare(
            'INSERT INTO messages (conv_id, sender_id, receiver_id, sender_fname, receiver_fname, content, metadata)
             VALUES (?, ?, ?, ?, ?, ?, ?)'
        );
        if (!$msgStmt) {
            continue;
        }
        $msgStmt->bind_param('iiissss', $conversationId, $sellerId, $buyerId, $senderName, $receiverName, $messageContent, $metadata);
        $msgStmt->execute();
        $msgId = $msgStmt->insert_id;
        $msgStmt->close();

        if ($msgId > 0) {
            $updateUnread = $conn->prepare(
                'UPDATE conversation_participants
                   SET unread_count = unread_count + 1,
                       first_unread_msg_id = CASE
                           WHEN first_unread_msg_id IS NULL OR first_unread_msg_id = 0 THEN ?
                           ELSE first_unread_msg_id
                       END
                 WHERE conv_id = ? AND user_id IN (?, ?)'
            );
            if ($updateUnread) {
                $updateUnread->bind_param('iiii', $msgId, $conversationId, $sellerId, $buyerId);
                $updateUnread->execute();
                $updateUnread->close();
            }
        }
    }
}
