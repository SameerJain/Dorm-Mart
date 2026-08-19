<?php

declare(strict_types=1);

require_once __DIR__ . '/../auth/auth_handle.php';
require __DIR__ . '/../database/db_connect.php';
require_once __DIR__ . '/../helpers/api_bootstrap.php';
require_once __DIR__ . '/../helpers/request.php';
require_once __DIR__ . '/../helpers/profanity.php';
require_once __DIR__ . '/helpers.php';

init_json_endpoint();

$conn = db();
$conn->set_charset('utf8mb4');

auth_boot_session();

// --- auth: require a logged-in user ---
$userId = require_login();

$sender = $userId;
$body = json_request_body();

require_csrf_token($body['csrf_token'] ?? null);

$receiverId = request_int($body, 'receiver_id');
$contentRaw = is_string($body['content'] ?? null) ? trim($body['content']) : '';
$convIdParam = array_key_exists('conv_id', $body) && $body['conv_id'] !== null
    ? strict_integer_value($body['conv_id'])
    : null;

if ($receiverId <= 0 || $contentRaw === '' || (array_key_exists('conv_id', $body) && $body['conv_id'] !== null && $convIdParam === null)) {
    json_response(['success' => false, 'error' => 'missing_fields'], 400);
}

$content = $contentRaw;

$len = function_exists('mb_strlen') ? mb_strlen($content, 'UTF-8') : strlen($content); // mb_strlen counts Unicode chars
if ($len > 500) {
    json_response([
        'success' => false,
        'error'   => 'content_too_long',
        'max'     => 500,
        'length'  => $len
    ], 400);
}

$senderId   = (int)$sender;
if ($senderId === $receiverId) {
    json_response(['success' => false, 'error' => 'Cannot message yourself'], 400);
}
$u1 = min($senderId, $receiverId);
$u2 = max($senderId, $receiverId);
$lockKey = "conv:$u1:$u2"; // used for advisory lock

$convId = null;
$msgId  = null;
/* will hold ISO-8601 UTC string, e.g., 2025-10-31T03:05:06Z */
$createdIso = null; // <-- will be filled after insert

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

    $names = chat_user_display_names($conn, $senderId, $receiverId);
    $senderName = $names[$senderId];
    $receiverName = $names[$receiverId];
    $convId = chat_resolve_direct_conversation(
        $conn,
        $u1,
        $u2,
        $names[$u1],
        $names[$u2],
        $convIdParam
    );
    if ($convId === null) {
        chat_release_lock($conn, $lockKey);
        json_response(['success' => false, 'error' => 'Invalid conversation ID'], 403);
    }

    // If item is deleted, block message creation
    if (chat_conversation_is_closed($conn, $convId)) {
        chat_release_lock($conn, $lockKey);
        $conn->rollback();
        json_response(['success' => false, 'error' => 'Item has been deleted. Cannot send messages.'], 403);
    }

    chat_ensure_participants($conn, $convId, $u1, $u2);
    chat_reopen_conversation($conn, $convId);

    // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
    $isFlagged = contains_profanity($conn, $content) ? 1 : 0;
    $stmt = $conn->prepare(
        'INSERT INTO messages
           (conv_id, sender_id, receiver_id, sender_fname, receiver_fname, content, is_flagged)
         VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    $stmt->bind_param('iiisssi', $convId, $senderId, $receiverId, $senderName, $receiverName, $content, $isFlagged);
    $stmt->execute();
    $msgId = $conn->insert_id;
    $stmt->close();

    /* Fetch the DB-assigned created_at in ISO-8601 UTC (matches your readers) */
    $stmt = $conn->prepare(
        'SELECT DATE_FORMAT(created_at, "%Y-%m-%dT%H:%i:%sZ") AS created_at
           FROM messages
          WHERE message_id = ?'
    );
    $stmt->bind_param('i', $msgId);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    $createdIso = $row ? (string)$row['created_at'] : null; // fallback handled below if null

    chat_increment_unread($conn, $msgId, $convId, $receiverId);

    $filteredContent = filter_profanity($conn, $content);

    chat_release_lock($conn, $lockKey);

    $conn->commit();

    if ($createdIso === null) {
        // Very defensive fallback; should rarely trigger since we SELECTed above.
        $createdIso = gmdate('Y-m-d\TH:i:s\Z'); // UTC "now"
    }

    json_response([
        'success'     => true,
        'conv_id'     => $convId,
        'message_id'  => $msgId,
        // Return the fields you asked for as a single object for the client
        'message'     => [
            'message_id' => $msgId,
            'content'    => $filteredContent,
            'is_flagged' => (bool)$isFlagged,
            'created_at' => $createdIso, // ISO-8601 UTC, e.g., 2025-10-31T03:05:06Z
        ],
    ], 200, JSON_UNESCAPED_SLASHES);
} catch (Throwable $e) {
    try { $conn->rollback(); } catch (Throwable $_) {}
    if ($lockKey) chat_release_lock($conn, $lockKey);
    json_response(['success' => false, 'error' => 'Server error'], 500);
}
