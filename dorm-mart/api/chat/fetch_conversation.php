<?php

declare(strict_types=1);
require_once __DIR__ . '/../helpers/api_bootstrap.php';
require_once __DIR__ . '/../auth/auth_handle.php';
require_once __DIR__ . '/../helpers/profanity.php';
require_once __DIR__ . '/../helpers/request.php';
require_once __DIR__ . '/../database/db_connect.php';
require_once __DIR__ . '/helpers.php';

init_json_endpoint();

$conn = db();

$userId = require_login();

$convId = request_int($_GET, 'conv_id');
if ($convId <= 0) {
    json_response(['success' => false, 'error' => 'conv_id is required'], 400);
}

chat_require_participant($conn, $convId, $userId);

$stmt = $conn->prepare('SELECT ' . CHAT_MESSAGE_COLUMNS . ' FROM messages WHERE conv_id = ? ORDER BY message_id ASC');
$stmt->bind_param('i', $convId);
$stmt->execute();
$res = $stmt->get_result();
$messages = [];
while ($row = $res->fetch_assoc()) {
    $messages[] = chat_message_payload($conn, $row, $userId);
}
$stmt->close();

// --- mark as read for the caller (sets "no unread"); skipped for cross-site links ---
if (request_is_same_origin_fetch()) {
    $stmt = $conn->prepare(
        'UPDATE conversation_participants
            SET unread_count = 0,
                first_unread_msg_id = 0
          WHERE conv_id = ? AND user_id = ?'
    );

    $stmt->bind_param('ii', $convId, $userId);
    $stmt->execute();
    $stmt->close();

    // Opening a conversation you hid (for example from a notification link)
    // restores it to your own list, so replies have somewhere to show up.
    // The other participant's flag is untouched.
    $stmt = $conn->prepare(
        'UPDATE conversations
            SET user1_deleted = CASE WHEN user1_id = ? THEN 0 ELSE user1_deleted END,
                user2_deleted = CASE WHEN user2_id = ? THEN 0 ELSE user2_deleted END
          WHERE conv_id = ?'
    );
    $stmt->bind_param('iii', $userId, $userId, $convId);
    $stmt->execute();
    $stmt->close();
}

$itemDeleted = false;
$stmt = $conn->prepare('SELECT item_deleted FROM conversations WHERE conv_id = ? LIMIT 1');
if ($stmt) {
    $stmt->bind_param('i', $convId);
    $stmt->execute();
    $stmt->bind_result($itemDeletedFlag);
    if ($stmt->fetch()) {
        $itemDeleted = (bool)$itemDeletedFlag;
    }
    $stmt->close();
}

json_response([
    'success'  => true,
    'conv_id'  => $convId,
    'messages' => $messages,
    'item_deleted' => $itemDeleted
]);
