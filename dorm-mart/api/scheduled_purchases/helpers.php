<?php
declare(strict_types=1);

function scheduled_purchase_has_active_accepted(mysqli $conn, int $productId, int $excludeRequestId): bool
{
    $stmt = $conn->prepare('
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
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare active accepted check');
    }

    $stmt->bind_param('ii', $productId, $excludeRequestId);
    $stmt->execute();
    $res = $stmt->get_result();
    $row = $res ? $res->fetch_assoc() : null;
    $stmt->close();

    return $row && (int)$row['cnt'] > 0;
}

function scheduled_purchase_utc_atom($value): ?string
{
    if ($value === null || $value === '') {
        return null;
    }

    $dt = date_create((string)$value, new DateTimeZone('UTC'));
    return $dt ? $dt->format(DateTime::ATOM) : null;
}

function scheduled_purchase_now_utc_atom(): string
{
    return (new DateTime('now', new DateTimeZone('UTC')))->format(DateTime::ATOM);
}

function scheduled_purchase_user_display_name(mysqli $conn, int $userId): string
{
    $names = scheduled_purchase_user_display_names($conn, [$userId]);
    return $names[$userId] ?? ('User ' . $userId);
}

function scheduled_purchase_user_display_names(mysqli $conn, array $userIds): array
{
    $ids = array_values(array_unique(array_filter(array_map('intval', $userIds), static fn($id) => $id > 0)));
    if (!$ids) {
        return [];
    }

    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $stmt = $conn->prepare("SELECT user_id, first_name, last_name FROM user_accounts WHERE user_id IN ($placeholders)");
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare user name lookup');
    }

    $types = str_repeat('i', count($ids));
    $stmt->bind_param($types, ...$ids);
    $stmt->execute();
    $res = $stmt->get_result();
    $names = [];
    while ($res && ($row = $res->fetch_assoc())) {
        $id = (int)$row['user_id'];
        $full = trim((string)$row['first_name'] . ' ' . (string)$row['last_name']);
        $names[$id] = $full !== '' ? $full : ('User ' . $id);
    }
    $stmt->close();

    foreach ($ids as $id) {
        $names[$id] = $names[$id] ?? ('User ' . $id);
    }

    return $names;
}

function scheduled_purchase_conversation_participants(mysqli $conn, int $conversationId): ?array
{
    $stmt = $conn->prepare('SELECT user1_id, user2_id FROM conversations WHERE conv_id = ? LIMIT 1');
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare conversation lookup');
    }

    $stmt->bind_param('i', $conversationId);
    $stmt->execute();
    $res = $stmt->get_result();
    $row = $res ? $res->fetch_assoc() : null;
    $stmt->close();

    return $row ?: null;
}

function scheduled_purchase_insert_chat_message(
    mysqli $conn,
    int $conversationId,
    int $senderId,
    int $receiverId,
    string $content,
    array $metadata,
    bool $incrementUnread = true
): int {
    $names = scheduled_purchase_user_display_names($conn, [$senderId, $receiverId]);
    $senderName = $names[$senderId] ?? ('User ' . $senderId);
    $receiverName = $names[$receiverId] ?? ('User ' . $receiverId);
    $metadataJson = json_encode($metadata, JSON_UNESCAPED_SLASHES);

    $msgStmt = $conn->prepare('INSERT INTO messages (conv_id, sender_id, receiver_id, sender_fname, receiver_fname, content, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)');
    if (!$msgStmt) {
        throw new RuntimeException('Failed to prepare schedule chat message');
    }
    $msgStmt->bind_param('iiissss', $conversationId, $senderId, $receiverId, $senderName, $receiverName, $content, $metadataJson);
    $msgStmt->execute();
    $msgId = $msgStmt->insert_id;
    $msgStmt->close();

    if ($incrementUnread) {
        $updateStmt = $conn->prepare('UPDATE conversation_participants SET unread_count = unread_count + 1, first_unread_msg_id = CASE WHEN first_unread_msg_id IS NULL OR first_unread_msg_id = 0 THEN ? ELSE first_unread_msg_id END WHERE conv_id = ? AND user_id = ?');
        if (!$updateStmt) {
            throw new RuntimeException('Failed to prepare unread update');
        }
        $updateStmt->bind_param('iii', $msgId, $conversationId, $receiverId);
        $updateStmt->execute();
        $updateStmt->close();
    }

    return $msgId;
}
