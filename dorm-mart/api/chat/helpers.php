<?php

declare(strict_types=1);

// Chat flood cap. Generous by design: this exists to stop scripted spam, not to
// pace a fast typist.
const CHAT_MESSAGE_MAX_PER_WINDOW = 40;
const CHAT_MESSAGE_WINDOW_MINUTES = 1;
const CHAT_MESSAGE_LOCKOUT_MINUTES = 1;
// Photos/videos per window; each can be up to 25 MB.
const CHAT_MEDIA_MAX_PER_WINDOW = 10;

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

function chat_user_exists(mysqli $conn, int $userId): bool
{
    $stmt = $conn->prepare('SELECT 1 FROM user_accounts WHERE user_id = ? LIMIT 1');
    if (!$stmt) throw new RuntimeException('Failed to prepare user lookup');
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $exists = $stmt->get_result()->num_rows === 1;
    $stmt->close();
    return $exists;
}

/**
 * Full names for the given user ids. Every positive id gets an entry; ids with
 * no account or a blank name fall back to "User <id>".
 *
 * @return array<int, string>
 */
function chat_display_names(mysqli $conn, array $userIds): array
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
    $stmt->bind_param(str_repeat('i', count($ids)), ...$ids);
    $stmt->execute();
    $res = $stmt->get_result();
    $names = [];
    while ($res && ($row = $res->fetch_assoc())) {
        $id = (int)$row['user_id'];
        $full = trim((string)$row['first_name'] . ' ' . (string)$row['last_name']);
        if ($full !== '') $names[$id] = $full;
    }
    $stmt->close();

    foreach ($ids as $id) {
        $names[$id] = $names[$id] ?? ('User ' . $id);
    }
    return $names;
}

function chat_user_display_names(mysqli $conn, int $user1Id, int $user2Id): array
{
    return chat_display_names($conn, [$user1Id, $user2Id]);
}

/**
 * Insert a system-generated chat message (schedule, confirm, payment cards)
 * carrying JSON metadata, and by default count it as unread for the receiver.
 *
 * @return int Inserted message id.
 */
function chat_insert_system_message(
    mysqli $conn,
    int $conversationId,
    int $senderId,
    int $receiverId,
    string $content,
    array $metadata,
    bool $incrementUnread = true
): int {
    $names = chat_display_names($conn, [$senderId, $receiverId]);
    $senderName = $names[$senderId] ?? ('User ' . $senderId);
    $receiverName = $names[$receiverId] ?? ('User ' . $receiverId);
    $metadataJson = json_encode($metadata, JSON_UNESCAPED_SLASHES);
    if ($metadataJson === false) {
        throw new RuntimeException('Failed to encode chat message metadata');
    }

    $msgStmt = $conn->prepare('INSERT INTO messages (conv_id, sender_id, receiver_id, sender_fname, receiver_fname, content, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)');
    if (!$msgStmt) {
        throw new RuntimeException('Failed to prepare chat message insert');
    }
    $msgStmt->bind_param('iiissss', $conversationId, $senderId, $receiverId, $senderName, $receiverName, $content, $metadataJson);
    $msgStmt->execute();
    $msgId = (int)$msgStmt->insert_id;
    $msgStmt->close();

    if ($incrementUnread) {
        chat_increment_unread($conn, $msgId, $conversationId, $receiverId);
    }
    return $msgId;
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

/**
 * Show a conversation in one participant's list again. Anything that adds to a
 * user's unread count must call this, otherwise the badge counts messages in a
 * conversation the user cannot open. The other participant's flag is untouched.
 */
function chat_unhide_for_user(mysqli $conn, int $conversationId, int $userId): void
{
    $stmt = $conn->prepare(
        'UPDATE conversations
            SET user1_deleted = CASE WHEN user1_id = ? THEN 0 ELSE user1_deleted END,
                user2_deleted = CASE WHEN user2_id = ? THEN 0 ELSE user2_deleted END
          WHERE conv_id = ?'
    );
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare conversation unhide');
    }
    $stmt->bind_param('iii', $userId, $userId, $conversationId);
    $stmt->execute();
    $stmt->close();
}

function chat_increment_unread(mysqli $conn, int $messageId, int $conversationId, int $receiverId): void
{
    chat_unhide_for_user($conn, $conversationId, $receiverId);
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
