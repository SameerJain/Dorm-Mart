<?php

declare(strict_types=1);

require_once __DIR__ . '/../database/db_connect.php';
require_once __DIR__ . '/../helpers/notifications.php';

function confirm_purchase_conversation(mysqli $conn, int $conversationId, int $productId): ?array
{
    $stmt = $conn->prepare(
        'SELECT c.conv_id, c.product_id, inv.seller_id, inv.title AS item_title
           FROM conversations c
           INNER JOIN INVENTORY inv ON inv.product_id = c.product_id
          WHERE c.conv_id = ? AND c.product_id = ?
          LIMIT 1'
    );
    if (!$stmt) throw new RuntimeException('Failed to prepare conversation lookup');
    $stmt->bind_param('ii', $conversationId, $productId);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    return $row ?: null;
}

function confirm_purchase_latest_accepted_schedule(
    mysqli $conn,
    int $conversationId,
    int $productId,
    ?int $sellerId = null
): ?array {
    $stmt = $conn->prepare(
        'SELECT spr.*, inv.title AS item_title, inv.listing_price,
                buyer.first_name AS buyer_first, buyer.last_name AS buyer_last
           FROM scheduled_purchase_requests spr
           INNER JOIN INVENTORY inv ON inv.product_id = spr.inventory_product_id
           INNER JOIN user_accounts buyer ON buyer.user_id = spr.buyer_user_id
          WHERE spr.conversation_id = ?
            AND spr.inventory_product_id = ?
            AND spr.status = \'accepted\'
            AND (? = 0 OR spr.seller_user_id = ?)
          ORDER BY COALESCE(spr.updated_at, spr.buyer_response_at) DESC, spr.request_id DESC
          LIMIT 1'
    );
    if (!$stmt) throw new RuntimeException('Failed to prepare scheduled purchase lookup');
    $sellerFilter = $sellerId ?? 0;
    $stmt->bind_param('iiii', $conversationId, $productId, $sellerFilter, $sellerFilter);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    return $row ?: null;
}

function confirm_purchase_utc_atom($value): ?string
{
    if ($value === null || $value === '') return null;
    $date = date_create((string)$value, new DateTimeZone('UTC'));
    return $date ? $date->format(DateTime::ATOM) : null;
}

/**
 * Fetches display names for the given user ids.
 *
 * @return array<int, string>
 */
function get_user_display_names(mysqli $conn, array $userIds): array
{
    if (empty($userIds)) {
        return [];
    }
    $placeholders = implode(',', array_fill(0, count($userIds), '?'));
    $types = str_repeat('i', count($userIds));

    $stmt = $conn->prepare(
        sprintf('SELECT user_id, first_name, last_name FROM user_accounts WHERE user_id IN (%s)', $placeholders)
    );
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare user lookup');
    }
    // bind_param requires references; build the array manually.
    $bindParams = [];
    $bindParams[] = $types;
    foreach ($userIds as $idx => $value) {
        $userIds[$idx] = (int)$value;
        $bindParams[] = &$userIds[$idx];
    }
    call_user_func_array([$stmt, 'bind_param'], $bindParams);
    $stmt->execute();
    $res = $stmt->get_result();
    $names = [];
    while ($row = $res->fetch_assoc()) {
        $id = (int)$row['user_id'];
        $full = trim((string)$row['first_name'] . ' ' . (string)$row['last_name']);
        $names[$id] = $full !== '' ? $full : ('User ' . $id);
    }
    $stmt->close();
    return $names;
}

/**
 * Inserts a chat message with JSON metadata and updates unread counts.
 *
 * @return int Inserted message id.
 */
function insert_confirm_chat_message(
    mysqli $conn,
    int $conversationId,
    int $senderId,
    int $receiverId,
    string $content,
    array $metadata
): int {
    $names = get_user_display_names($conn, [$senderId, $receiverId]);
    $senderName = $names[$senderId] ?? ('User ' . $senderId);
    $receiverName = $names[$receiverId] ?? ('User ' . $receiverId);
    $metadataJson = json_encode($metadata, JSON_UNESCAPED_SLASHES);
    if ($metadataJson === false) {
        throw new RuntimeException('Failed to encode metadata');
    }

    $msgStmt = $conn->prepare('INSERT INTO messages (conv_id, sender_id, receiver_id, sender_fname, receiver_fname, content, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)');
    if (!$msgStmt) {
        throw new RuntimeException('Failed to prepare message insert');
    }
    $msgStmt->bind_param('iiissss', $conversationId, $senderId, $receiverId, $senderName, $receiverName, $content, $metadataJson);
    $msgStmt->execute();
    $msgId = (int)$msgStmt->insert_id;
    $msgStmt->close();

    $updateStmt = $conn->prepare('UPDATE conversation_participants SET unread_count = unread_count + 1, first_unread_msg_id = CASE WHEN first_unread_msg_id IS NULL OR first_unread_msg_id = 0 THEN ? ELSE first_unread_msg_id END WHERE conv_id = ? AND user_id = ?');
    if ($updateStmt) {
        $updateStmt->bind_param('iii', $msgId, $conversationId, $receiverId);
        $updateStmt->execute();
        $updateStmt->close();
    }

    return $msgId;
}

function get_conversation_receiver_id(mysqli $conn, int $conversationId, int $senderId): ?int
{
    $stmt = $conn->prepare('SELECT user1_id, user2_id FROM conversations WHERE conv_id = ? LIMIT 1');
    if (!$stmt) {
        return null;
    }

    $stmt->bind_param('i', $conversationId);
    $stmt->execute();
    $res = $stmt->get_result();
    $row = $res ? $res->fetch_assoc() : null;
    $stmt->close();

    if (!$row) {
        return null;
    }

    $user1Id = (int)$row['user1_id'];
    $user2Id = (int)$row['user2_id'];
    if ($user1Id === $senderId) {
        return $user2Id;
    }
    if ($user2Id === $senderId) {
        return $user1Id;
    }

    return null;
}

function delete_confirm_request_message(mysqli $conn, int $conversationId, int $confirmRequestId, string $logContext = ''): void
{
    try {
        $findStmt = $conn->prepare('SELECT message_id, metadata FROM messages WHERE conv_id = ? ORDER BY message_id DESC');
        if (!$findStmt) {
            return;
        }

        $findStmt->bind_param('i', $conversationId);
        if (!$findStmt->execute()) {
            error_log('Failed to execute confirm message lookup' . $logContext . ': ' . $findStmt->error);
            $findStmt->close();
            return;
        }

        $findRes = $findStmt->get_result();
        $originalMsgId = null;

        while ($msgRow = $findRes->fetch_assoc()) {
            $msgMetadata = json_decode($msgRow['metadata'] ?? '{}', true);
            if (
                is_array($msgMetadata) &&
                ($msgMetadata['type'] ?? '') === 'confirm_request' &&
                (int)($msgMetadata['confirm_request_id'] ?? 0) === $confirmRequestId
            ) {
                $originalMsgId = (int)$msgRow['message_id'];
                break;
            }
        }
        $findStmt->close();

        if ($originalMsgId === null) {
            error_log('Original confirm_request message not found' . $logContext . ': confirm_request_id=' . $confirmRequestId);
            return;
        }

        $deleteStmt = $conn->prepare('DELETE FROM messages WHERE message_id = ? LIMIT 1');
        if (!$deleteStmt) {
            return;
        }

        $deleteStmt->bind_param('i', $originalMsgId);
        if (!$deleteStmt->execute()) {
            error_log('Failed to execute confirm message deletion' . $logContext . ': ' . $deleteStmt->error);
        }
        $deleteStmt->close();
    } catch (Throwable $e) {
        error_log('Error deleting original confirm_request message' . $logContext . ': ' . $e->getMessage() . ' for confirm_request_id=' . $confirmRequestId);
    }
}

/**
 * Upserts the buyer's purchase history record with the latest product id payload.
 *
 * @param array $payload Arbitrary data to capture (must be JSON encodable).
 */
function record_purchase_history(mysqli $conn, int $userId, int $productId, array $payload): void
{
    $nowIso = (new DateTime('now', new DateTimeZone('UTC')))->format(DateTime::ATOM);
    $entry = [
        'product_id'      => $productId,
        'recorded_at'     => $nowIso,
        'confirm_payload' => $payload,
    ];
    $entryJson = json_encode($entry, JSON_UNESCAPED_SLASHES);
    if ($entryJson === false) {
        throw new RuntimeException('Failed to encode purchase history entry');
    }

    // Single atomic upsert: appends the entry whether or not a row exists yet.
    // JSON_ARRAY_APPEND on the UPDATE path avoids the SELECT→deserialize→UPDATE
    // race condition where two simultaneous completions could overwrite each other.
    $stmt = $conn->prepare('
        INSERT INTO purchase_history (user_id, items)
        VALUES (?, JSON_ARRAY(JSON_EXTRACT(?, \'$\')))
        ON DUPLICATE KEY UPDATE
            items      = JSON_ARRAY_APPEND(items, \'$\', JSON_EXTRACT(?, \'$\')),
            updated_at = NOW()
    ');
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare purchase history upsert');
    }
    $stmt->bind_param('iss', $userId, $entryJson, $entryJson);
    if (!$stmt->execute()) {
        throw new RuntimeException('Failed to execute purchase history upsert');
    }
    $stmt->close();
}

function get_confirm_snapshot(array $row): array
{
    if (empty($row['payload_snapshot'])) {
        return [];
    }
    $decoded = json_decode($row['payload_snapshot'], true);
    return is_array($decoded) ? $decoded : [];
}

function resolve_confirm_final_price(mysqli $conn, array $row, array $snapshot): ?float
{
    if (isset($row['final_price']) && $row['final_price'] !== null) {
        return (float)$row['final_price'];
    }
    if (isset($snapshot['negotiated_price']) && $snapshot['negotiated_price'] !== null) {
        return (float)$snapshot['negotiated_price'];
    }

    $productId = isset($row['inventory_product_id']) ? (int)$row['inventory_product_id'] : 0;
    if ($productId <= 0) {
        return null;
    }

    $priceStmt = $conn->prepare('SELECT listing_price FROM INVENTORY WHERE product_id = ? LIMIT 1');
    if (!$priceStmt) {
        return null;
    }
    $priceStmt->bind_param('i', $productId);
    $priceStmt->execute();
    $res = $priceStmt->get_result();
    $priceRow = $res ? $res->fetch_assoc() : null;
    $priceStmt->close();

    if ($priceRow && $priceRow['listing_price'] !== null) {
        return (float)$priceRow['listing_price'];
    }

    return null;
}

function mark_inventory_as_sold(mysqli $conn, array $row): void
{
    if (empty($row['is_successful'])) {
        return;
    }

    $productId = isset($row['inventory_product_id']) ? (int)$row['inventory_product_id'] : 0;
    $buyerId = isset($row['buyer_user_id']) ? (int)$row['buyer_user_id'] : 0;
    if ($productId <= 0 || $buyerId <= 0) {
        return;
    }

    $snapshot = get_confirm_snapshot($row);
    $finalPrice = resolve_confirm_final_price($conn, $row, $snapshot);
    if ($finalPrice === null) {
        $finalPrice = 0.0;
    }

    $itemStmt = $conn->prepare('SELECT title, photos FROM INVENTORY WHERE product_id = ? LIMIT 1');
    if (!$itemStmt) throw new RuntimeException('Failed to prepare item notification snapshot');
    $itemStmt->bind_param('i', $productId);
    $itemStmt->execute();
    $item = $itemStmt->get_result()->fetch_assoc();
    $itemStmt->close();
    $title = (string)($item['title'] ?? 'Item');
    $image = notification_first_image($item['photos'] ?? null);

    $status = 'Sold';
    $updateSql = 'UPDATE INVENTORY SET item_status = ?, sold = 1, wishlisted = 0, final_price = ?, date_sold = CURDATE(), sold_to = ? WHERE product_id = ?';
    $stmt = $conn->prepare($updateSql);
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare inventory sold update');
    }
    $stmt->bind_param('sdii', $status, $finalPrice, $buyerId, $productId);
    $stmt->execute();
    $stmt->close();
    notification_for_wishlist($conn, $productId, [
        'type' => 'item_sold', 'title' => $title, 'message' => $title . ' has been sold.',
        'image_url' => $image, 'severity' => 'warning', 'destination' => null,
        'idempotency_key' => 'sold-confirm-' . (int)($row['confirm_request_id'] ?? 0),
    ], $buyerId);
    notification_insert($conn, [
        'recipient_user_id' => $buyerId, 'type' => 'review_reminder', 'product_id' => $productId,
        'scheduled_request_id' => (int)($row['scheduled_request_id'] ?? 0), 'title' => $title,
        'message' => 'Please leave a review for your completed purchase.', 'image_url' => $image,
        'severity' => 'info', 'destination' => '/app/purchase-history?review=' . $productId,
        'idempotency_key' => 'review-reminder-' . (int)($row['confirm_request_id'] ?? 0),
        'available_at' => gmdate('Y-m-d H:i:s', time() + 86400),
    ]);
    $wishlistDelete = $conn->prepare('DELETE FROM wishlist WHERE product_id = ?');
    if (!$wishlistDelete) throw new RuntimeException('Failed to remove sold item from wishlists');
    $wishlistDelete->bind_param('i', $productId);
    $wishlistDelete->execute();
    $wishlistDelete->close();
}

function release_inventory_after_unsuccessful_confirm(mysqli $conn, array $row): void
{
    if (!isset($row['is_successful']) || (bool)$row['is_successful']) {
        return;
    }

    $productId = isset($row['inventory_product_id']) ? (int)$row['inventory_product_id'] : 0;
    $scheduledRequestId = isset($row['scheduled_request_id']) ? (int)$row['scheduled_request_id'] : 0;
    if ($productId <= 0 || $scheduledRequestId <= 0) {
        return;
    }

    $checkStmt = $conn->prepare('
        SELECT COUNT(*) as cnt
        FROM scheduled_purchase_requests spr
        WHERE spr.inventory_product_id = ?
          AND spr.status = \'accepted\'
          AND spr.request_id != ?
          AND COALESCE((
            SELECT CASE
              WHEN cpr.status IN (\'buyer_accepted\', \'auto_accepted\') AND cpr.is_successful = 0 THEN 0
              ELSE 1
            END
            FROM confirm_purchase_requests cpr
            WHERE cpr.scheduled_request_id = spr.request_id
            ORDER BY cpr.confirm_request_id DESC
            LIMIT 1
          ), 1) = 1
    ');
    if (!$checkStmt) {
        throw new RuntimeException('Failed to prepare active schedule check');
    }
    $checkStmt->bind_param('ii', $productId, $scheduledRequestId);
    $checkStmt->execute();
    $res = $checkStmt->get_result();
    $rowCount = $res ? $res->fetch_assoc() : null;
    $checkStmt->close();

    if ($rowCount && (int)$rowCount['cnt'] > 0) {
        return;
    }

    $activeStatus = 'Active';
    $pendingStatus = 'Pending';
    $updateStmt = $conn->prepare('UPDATE INVENTORY SET item_status = ? WHERE product_id = ? AND item_status = ?');
    if (!$updateStmt) {
        throw new RuntimeException('Failed to prepare inventory release update');
    }
    $updateStmt->bind_param('sis', $activeStatus, $productId, $pendingStatus);
    $updateStmt->execute();
    if ($updateStmt->affected_rows > 0) {
        $itemStmt = $conn->prepare('SELECT title, photos FROM INVENTORY WHERE product_id = ? LIMIT 1');
        if (!$itemStmt) throw new RuntimeException('Failed to prepare released item');
        $itemStmt->bind_param('i', $productId);
        $itemStmt->execute();
        $item = $itemStmt->get_result()->fetch_assoc();
        $itemStmt->close();
        notification_for_wishlist($conn, $productId, [
            'type' => 'item_back_on_sale', 'title' => (string)($item['title'] ?? 'Item'),
            'message' => ($item['title'] ?? 'Item') . ' is back on sale.',
            'image_url' => notification_first_image($item['photos'] ?? null),
            'severity' => 'success', 'destination' => '/app/viewProduct/' . $productId,
            'idempotency_key' => 'back-on-sale-confirm-' . $scheduledRequestId,
        ]);
    }
    $updateStmt->close();
}

/**
 * If the pending confirm request is past expires_at, mark it as auto accepted,
 * deliver a chat message, and record purchase history. Returns the updated row.
 */
function auto_finalize_confirm_request(mysqli $conn, array $row): ?array
{
    if (($row['status'] ?? '') !== 'pending') {
        return $row;
    }

    $expiresAt = isset($row['expires_at']) ? DateTime::createFromFormat('Y-m-d H:i:s', $row['expires_at'], new DateTimeZone('UTC')) : false;
    if (!$expiresAt) {
        return $row;
    }

    $now = new DateTime('now', new DateTimeZone('UTC'));
    if ($now <= $expiresAt) {
        return $row;
    }

    $confirmId = (int)$row['confirm_request_id'];
    $updateStmt = $conn->prepare("UPDATE confirm_purchase_requests SET status = 'auto_accepted', auto_processed_at = NOW(), buyer_response_at = NOW() WHERE confirm_request_id = ? AND status = 'pending' LIMIT 1");
    if (!$updateStmt) {
        throw new RuntimeException('Failed to prepare auto-finalize update');
    }
    $updateStmt->bind_param('i', $confirmId);
    $updateStmt->execute();
    $wasUpdated = $updateStmt->affected_rows > 0;
    $updateStmt->close();

    if (!$wasUpdated) {
        return $row;
    }

    $selectStmt = $conn->prepare('SELECT * FROM confirm_purchase_requests WHERE confirm_request_id = ? LIMIT 1');
    if (!$selectStmt) {
        throw new RuntimeException('Failed to prepare confirm lookup');
    }
    $selectStmt->bind_param('i', $confirmId);
    $selectStmt->execute();
    $res = $selectStmt->get_result();
    $updatedRow = $res ? $res->fetch_assoc() : $row;
    $selectStmt->close();

    if ($updatedRow) {
        $conversationId = (int)$updatedRow['conversation_id'];
        $buyerId = (int)$updatedRow['buyer_user_id'];
        $metadata = build_confirm_response_metadata($updatedRow, 'confirm_auto_accepted');
        
        if ($conversationId > 0) {
            $receiverId = get_conversation_receiver_id($conn, $conversationId, $buyerId);
            if ($receiverId !== null) {
                delete_confirm_request_message($conn, $conversationId, $confirmId, ' (auto-accept)');
                insert_confirm_chat_message(
                    $conn,
                    $conversationId,
                    $buyerId,
                    $receiverId,
                    'Confirmation automatically accepted after 24 hours.',
                    $metadata
                );
            }
        }

        if ((bool)$updatedRow['is_successful']) {
            mark_inventory_as_sold($conn, $updatedRow);
            record_purchase_history($conn, $buyerId, (int)$updatedRow['inventory_product_id'], [
                'confirm_request_id' => $confirmId,
                'is_successful' => true,
                'final_price' => $updatedRow['final_price'] !== null ? (float)$updatedRow['final_price'] : null,
                'failure_reason' => $updatedRow['failure_reason'],
                'seller_notes' => $updatedRow['seller_notes'],
                'failure_reason_notes' => $updatedRow['failure_reason_notes'],
                'auto_accepted' => true,
            ]);
        } else {
            release_inventory_after_unsuccessful_confirm($conn, $updatedRow);
        }
    }

    return $updatedRow;
}

/**
 * Builds a metadata payload for confirm responses so that React can display a card.
 */
function build_confirm_response_metadata(array $row, string $type): array
{
    $snapshot = [];
    if (!empty($row['payload_snapshot'])) {
        $decoded = json_decode($row['payload_snapshot'], true);
        if (is_array($decoded)) {
            $snapshot = $decoded;
        }
    }

    // Determine confirm_purchase_status based on type and row status
    $confirmPurchaseStatus = null;
    if ($type === 'confirm_accepted') {
        $confirmPurchaseStatus = 'buyer_accepted';
    } elseif ($type === 'confirm_auto_accepted') {
        $confirmPurchaseStatus = 'auto_accepted';
    } elseif ($type === 'confirm_denied') {
        $confirmPurchaseStatus = 'buyer_declined';
    } elseif (isset($row['status'])) {
        // Fallback to row status if type doesn't match
        $status = (string)$row['status'];
        if ($status === 'buyer_accepted') {
            $confirmPurchaseStatus = 'buyer_accepted';
        } elseif ($status === 'auto_accepted') {
            $confirmPurchaseStatus = 'auto_accepted';
        } elseif ($status === 'buyer_declined') {
            $confirmPurchaseStatus = 'buyer_declined';
        }
    }

    return [
        'type' => $type,
        'confirm_request_id' => (int)$row['confirm_request_id'],
        'scheduled_request_id' => isset($row['scheduled_request_id']) ? (int)$row['scheduled_request_id'] : null,
        'inventory_product_id' => isset($row['inventory_product_id']) ? (int)$row['inventory_product_id'] : null,
        'is_successful' => isset($row['is_successful']) ? (bool)$row['is_successful'] : null,
        'final_price' => isset($row['final_price']) ? (float)$row['final_price'] : null,
        'seller_notes' => $row['seller_notes'] ?? null,
        'failure_reason' => $row['failure_reason'] ?? null,
        'failure_reason_notes' => $row['failure_reason_notes'] ?? null,
        'snapshot' => $snapshot,
        'responded_at' => (new DateTime('now', new DateTimeZone('UTC')))->format(DateTime::ATOM),
        'confirm_purchase_status' => $confirmPurchaseStatus,
    ];
}
