<?php

declare(strict_types=1);
header('Content-Type: application/json');

// __DIR__ points to api/
require __DIR__ . '/../database/db_connect.php';

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$conn = db();
$conn->set_charset('utf8mb4');

$body = json_decode(file_get_contents('php://input'), true);
$sender   = isset($body['sender_id'])   ? trim((string)$body['sender_id'])   : '';
$receiver = isset($body['receiver_id']) ? trim((string)$body['receiver_id']) : '';
$text     = isset($body['text'])        ? trim((string)$body['text'])        : '';

if ($sender === '' || $receiver === '' || $text === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'missing_fields']);
    exit;
}

$senderId   = (int)$sender;
$receiverId = (int)$receiver;
$u1 = min($senderId, $receiverId);
$u2 = max($senderId, $receiverId);
$lockKey = "conv:$u1:$u2"; // used for advisory lock

$convId = null;
$msgId  = null;

try {
    // Start atomic sequence (all or nothing)
    $conn->begin_transaction();

    // Acquire an advisory lock to avoid duplicate conversation rows under concurrency.
    // Comment: GET_LOCK returns 1 (acquired), 0 (timeout), NULL (error).
    $stmt = $conn->prepare('SELECT GET_LOCK(?, 5) AS got_lock');
    $stmt->bind_param('s', $lockKey);
    $stmt->execute();
    $res = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    if (!$res || (int)$res['got_lock'] !== 1) {
        throw new RuntimeException('Busy. Try again.');
    }

    // Find existing conversation
    $stmt = $conn->prepare('SELECT conv_id FROM conversations WHERE user_1 = ? AND user_2 = ? LIMIT 1');
    $stmt->bind_param('ii', $u1, $u2);
    $stmt->execute();
    $stmt->bind_result($convIdFound);
    if ($stmt->fetch()) {
        $convId = (int)$convIdFound;
    }
    $stmt->close();

    // If not found, create it
    if ($convId === null) {
        $stmt = $conn->prepare('INSERT INTO conversations (user_1, user_2) VALUES (?, ?)');
        $stmt->bind_param('ii', $u1, $u2);
        $stmt->execute();
        $convId = $conn->insert_id;
        $stmt->close();
    }

    // Ensure both participants exist
    // Comment: INSERT IGNORE is safe here because PK (conv_id, user_id) prevents duplicates.
    $stmt = $conn->prepare(
        'INSERT IGNORE INTO conversation_participants (conv_id, user_id, first_unread_msg_id, unread_count)
         VALUES (?, ?, 0, 0), (?, ?, 0, 0)'
    );
    $stmt->bind_param('iiii', $convId, $u1, $convId, $u2);
    $stmt->execute();
    $stmt->close();

    // Insert the message
    $stmt = $conn->prepare(
        'INSERT INTO messages (conv_id, sender_id, receiver_id, content) VALUES (?, ?, ?, ?)'
    );
    $stmt->bind_param('iiis', $convId, $senderId, $receiverId, $text);
    $stmt->execute();
    $msgId = $conn->insert_id;
    $stmt->close();

    // Update receiver's unread counters
    // Comment: Only set first_unread_msg_id if it was NULL/0; always increment unread_count.
    $stmt = $conn->prepare(
        'UPDATE conversation_participants
           SET unread_count = unread_count + 1,
               first_unread_msg_id = CASE
                   WHEN first_unread_msg_id IS NULL OR first_unread_msg_id = 0 THEN ?
                   ELSE first_unread_msg_id
               END
         WHERE conv_id = ? AND user_id = ?'
    );
    $stmt->bind_param('iii', $msgId, $convId, $receiverId);
    $stmt->execute();
    $stmt->close();

    // Release advisory lock
    $stmt = $conn->prepare('SELECT RELEASE_LOCK(?)');
    $stmt->bind_param('s', $lockKey);
    $stmt->execute();
    $stmt->close();

    $conn->commit();

    echo json_encode([
        'success'     => true,
        'conv_id'     => $convId,
        'message_id'  => $msgId
    ]);
} catch (Throwable $e) {
    // Try to roll back if we can
    if ($conn->errno === 0) { // not perfect, but prevents rollback errors after disconnects
        $conn->rollback();
    }
    // Best-effort: release lock if held
    if ($lockKey) {
        $stmt = $conn->prepare('SELECT RELEASE_LOCK(?)');
        if ($stmt) {
            $stmt->bind_param('s', $lockKey);
            $stmt->execute();
            $stmt->close();
        }
    }
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Server error']);
}
