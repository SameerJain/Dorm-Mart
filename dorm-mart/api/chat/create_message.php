<?php

declare(strict_types=1);
header('Content-Type: application/json');

require_once __DIR__ . '/../security/security.php';
setSecurityHeaders();
setSecureCORS();

require __DIR__ . '/../database/db_connect.php';

session_start(); // read the PHP session cookie to identify the caller

// --- auth: require a logged-in user ---
$userId = $userId = (int)($_SESSION['user_id'] ?? 0);

if ($userId <= 0) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Not authenticated']);
    exit;
}

$conn = db();
$conn->set_charset('utf8mb4');


$sender = $userId;
$body = json_decode(file_get_contents('php://input'), true);
$receiver = isset($body['receiver_id']) ? trim((string)$body['receiver_id']) : '';
$content  = isset($body['content'])     ? trim((string)$body['content'])     : '';

if ($sender === '' || $receiver === '' || $content === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'missing_fields']);
    exit;
}

$len = function_exists('mb_strlen') ? mb_strlen($content, 'UTF-8') : strlen($content); // mb_strlen counts Unicode chars
if ($len > 500) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error'   => 'content_too_long',
        'max'     => 500,
        'length'  => $len
    ]);
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
    $conn->begin_transaction();

    // Acquire advisory lock to avoid duplicate conversation rows under concurrency.
    $stmt = $conn->prepare('SELECT GET_LOCK(?, 5) AS got_lock');
    $stmt->bind_param('s', $lockKey);
    $stmt->execute();
    $res = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    if (!$res || (int)$res['got_lock'] !== 1) {
        throw new RuntimeException('Busy. Try again.');
    }

    // -------- Look up sender/receiver full names (used for messages AND conversation create) --------
    $stmt = $conn->prepare(
        'SELECT user_id, first_name, last_name
           FROM user_accounts
          WHERE user_id IN (?, ?)'
    );
    $stmt->bind_param('ii', $senderId, $receiverId);   // 'ii' = two integers
    $stmt->execute();
    $result = $stmt->get_result();

    // Fallbacks if anything is missing
    $senderName   = 'User ' . $senderId;
    $receiverName = 'User ' . $receiverId;

    while ($row = $result->fetch_assoc()) {
        // Build "First Last"; trim handles missing last names cleanly
        $full = trim(($row['first_name'] ?? '') . ' ' . ($row['last_name'] ?? ''));
        if ((int)$row['user_id'] === $senderId) {
            $senderName = $full !== '' ? $full : $senderName;
        } elseif ((int)$row['user_id'] === $receiverId) {
            $receiverName = $full !== '' ? $full : $receiverName;
        }
    }
    $stmt->close();
    // Map names to the ordered pair (u1/u2) required by conversations table
    $u1Name = ($u1 === $senderId) ? $senderName  : $receiverName;
    $u2Name = ($u2 === $senderId) ? $senderName  : $receiverName;
    // -------- end name lookup --------

    // Find existing conversation (NEW SCHEMA: user1_id/user2_id)
    $stmt = $conn->prepare('SELECT conv_id FROM conversations WHERE user1_id = ? AND user2_id = ? LIMIT 1');
    $stmt->bind_param('ii', $u1, $u2);
    $stmt->execute();
    $stmt->bind_result($convIdFound);
    if ($stmt->fetch()) {
        $convId = (int)$convIdFound;
    }
    $stmt->close();

    // If not found, create it (must supply NOT NULL name columns)
    if ($convId === null) {
        $stmt = $conn->prepare(
            'INSERT INTO conversations (user1_id, user2_id, user1_fname, user2_fname)
             VALUES (?, ?, ?, ?)'
        );
        // 'iiss' => two integers, two strings
        $stmt->bind_param('iiss', $u1, $u2, $u1Name, $u2Name);
        $stmt->execute();
        $convId = $conn->insert_id;
        $stmt->close();
    }

    // Ensure both participants exist
    $stmt = $conn->prepare(
        'INSERT IGNORE INTO conversation_participants (conv_id, user_id, first_unread_msg_id, unread_count)
         VALUES (?, ?, 0, 0), (?, ?, 0, 0)'
    );
    $stmt->bind_param('iiii', $convId, $u1, $convId, $u2);
    $stmt->execute();
    $stmt->close();

    // Insert the message WITH names (NEW SCHEMA: sender_fname/receiver_fname)
    $stmt = $conn->prepare(
        'INSERT INTO messages
           (conv_id, sender_id, receiver_id, sender_fname, receiver_fname, content)
         VALUES (?, ?, ?, ?, ?, ?)'
    );
    // 'iiisss' => 3 ints, 3 strings
    $stmt->bind_param('iiisss', $convId, $senderId, $receiverId, $senderName, $receiverName, $content);
    $stmt->execute();
    $msgId = $conn->insert_id;
    $stmt->close();

    // Update receiver's unread counters
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
    if ($conn->errno === 0) {
        $conn->rollback();
    }
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
