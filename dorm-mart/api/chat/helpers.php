<?php
declare(strict_types=1);

function chat_release_lock(mysqli $conn, string $lockKey): void
{
    try {
        $stmt = $conn->prepare('SELECT RELEASE_LOCK(?)');
        if (!$stmt) return;
        $stmt->bind_param('s', $lockKey);
        $stmt->execute();
        $stmt->close();
    } catch (Throwable $e) {
        error_log('chat lock release failed: ' . $e->getMessage());
    }
}

function chat_user_display_names(mysqli $conn, int $user1Id, int $user2Id): array
{
    $names = [$user1Id => 'User ' . $user1Id, $user2Id => 'User ' . $user2Id];
    $stmt = $conn->prepare(
        'SELECT user_id, first_name, last_name FROM user_accounts WHERE user_id IN (?, ?)'
    );
    $stmt->bind_param('ii', $user1Id, $user2Id);
    $stmt->execute();
    $result = $stmt->get_result();
    while ($row = $result->fetch_assoc()) {
        $id = (int)$row['user_id'];
        $fullName = trim(($row['first_name'] ?? '') . ' ' . ($row['last_name'] ?? ''));
        if ($fullName !== '') $names[$id] = $fullName;
    }
    $stmt->close();
    return $names;
}

function chat_resolve_direct_conversation(
    mysqli $conn,
    int $user1Id,
    int $user2Id,
    string $user1Name,
    string $user2Name,
    ?int $requestedConversationId
): ?int {
    if ($requestedConversationId !== null && $requestedConversationId > 0) {
        $stmt = $conn->prepare(
            'SELECT conv_id FROM conversations WHERE conv_id = ? AND user1_id = ? AND user2_id = ? LIMIT 1'
        );
        $stmt->bind_param('iii', $requestedConversationId, $user1Id, $user2Id);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        return $row ? (int)$row['conv_id'] : null;
    }

    $stmt = $conn->prepare(
        'SELECT conv_id FROM conversations WHERE user1_id = ? AND user2_id = ? LIMIT 1'
    );
    $stmt->bind_param('ii', $user1Id, $user2Id);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    if ($row) return (int)$row['conv_id'];

    $stmt = $conn->prepare(
        'INSERT INTO conversations (user1_id, user2_id, user1_fname, user2_fname) VALUES (?, ?, ?, ?)'
    );
    $stmt->bind_param('iiss', $user1Id, $user2Id, $user1Name, $user2Name);
    $stmt->execute();
    $conversationId = (int)$conn->insert_id;
    $stmt->close();
    return $conversationId;
}

function chat_conversation_is_closed(mysqli $conn, int $conversationId): bool
{
    $stmt = $conn->prepare('SELECT item_deleted FROM conversations WHERE conv_id = ? LIMIT 1');
    $stmt->bind_param('i', $conversationId);
    $stmt->execute();
    $stmt->bind_result($itemDeleted);
    $closed = $stmt->fetch() && (bool)$itemDeleted;
    $stmt->close();
    return $closed;
}

function chat_ensure_participants(mysqli $conn, int $conversationId, int $user1Id, int $user2Id): void
{
    $stmt = $conn->prepare(
        'INSERT IGNORE INTO conversation_participants (conv_id, user_id, first_unread_msg_id, unread_count)
         VALUES (?, ?, 0, 0), (?, ?, 0, 0)'
    );
    $stmt->bind_param('iiii', $conversationId, $user1Id, $conversationId, $user2Id);
    $stmt->execute();
    $stmt->close();
}

function chat_reopen_conversation(mysqli $conn, int $conversationId): void
{
    $stmt = $conn->prepare(
        'UPDATE conversations SET user1_deleted = 0, user2_deleted = 0 WHERE conv_id = ?'
    );
    $stmt->bind_param('i', $conversationId);
    $stmt->execute();
    $stmt->close();
}

function chat_increment_unread(mysqli $conn, int $messageId, int $conversationId, int $receiverId): void
{
    $stmt = $conn->prepare(
        'UPDATE conversation_participants
            SET unread_count = unread_count + 1,
                first_unread_msg_id = CASE
                    WHEN first_unread_msg_id IS NULL OR first_unread_msg_id = 0 THEN ?
                    ELSE first_unread_msg_id
                END
          WHERE conv_id = ? AND user_id = ?'
    );
    $stmt->bind_param('iii', $messageId, $conversationId, $receiverId);
    $stmt->execute();
    $stmt->close();
}
