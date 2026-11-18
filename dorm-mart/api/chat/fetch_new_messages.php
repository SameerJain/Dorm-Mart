<?php

require_once __DIR__ . '/../helpers/api_bootstrap.php';
require_once __DIR__ . '/../auth/auth_handle.php';
require_once __DIR__ . '/../helpers/profanity.php';
require_once __DIR__ . '/../helpers/request.php';
require_once __DIR__ . '/../database/db_connect.php';
require_once __DIR__ . '/helpers.php';

init_json_endpoint();

auth_boot_session();
$userId = require_login();
// This endpoint is polled continuously and never writes the session. Releasing
// the lock now stops each poll from queueing the user's other requests.
session_write_close();

$conn = db();

$convId = request_int($_GET, 'conv_id');
$tsSec  = array_key_exists('ts', $_GET) ? strict_integer_value($_GET['ts']) : 0;

if ($convId <= 0 || $tsSec === null || $tsSec < 0) {
    json_response(['success' => false, 'error' => 'Invalid conversation query'], 400);
}

chat_require_participant($conn, $convId, $userId);

$stmt = $conn->prepare(
    'SELECT ' . CHAT_MESSAGE_COLUMNS . ',
       DATE_FORMAT(GREATEST(created_at, COALESCE(edited_at, created_at), COALESCE(deleted_at, created_at)), "%Y-%m-%dT%H:%i:%sZ") AS activity_at
     FROM messages
    WHERE conv_id = ?
      AND (created_at >= FROM_UNIXTIME(?) OR edited_at >= FROM_UNIXTIME(?) OR deleted_at >= FROM_UNIXTIME(?))
    ORDER BY message_id ASC'
);
$stmt->bind_param('iiii', $convId, $tsSec, $tsSec, $tsSec);
$stmt->execute();
$res = $stmt->get_result();
$messages = [];
while ($row = $res->fetch_assoc()) {
    $messages[] = chat_message_payload($conn, $row, $userId);
}
$stmt->close();

// --- mark as read for the caller (sets "no unread"); skipped for cross-site links ---
// The unread_count guard keeps idle polls from rewriting the row every tick.
if (request_is_same_origin_fetch()) {
    $stmt = $conn->prepare(
        'UPDATE conversation_participants
            SET unread_count = 0,
                first_unread_msg_id = 0
          WHERE conv_id = ? AND user_id = ? AND (unread_count > 0 OR first_unread_msg_id <> 0)'
    );
    $stmt->bind_param('ii', $convId, $userId);
    $stmt->execute();
    $stmt->close();
}

$typingStatus = [
    'is_typing' => false,
    'typing_user_first_name' => null
];
$conversationStatus = null;

$convStmt = $conn->prepare(
    'SELECT c.user1_id, c.user2_id, c.item_deleted, inv.item_status AS product_status
       FROM conversations c
       LEFT JOIN INVENTORY inv ON inv.product_id = c.product_id
      WHERE c.conv_id = ?
      LIMIT 1'
);
$convStmt->bind_param('i', $convId);
$convStmt->execute();
$convRes = $convStmt->get_result();
if ($convRes && $convRes->num_rows > 0) {
    $convRow = $convRes->fetch_assoc();
    $conversationStatus = [
        'product_status' => $convRow['product_status'] ?? null,
        'item_deleted' => (bool)($convRow['item_deleted'] ?? false),
    ];
    $otherUserId = ((int)$convRow['user1_id'] === $userId) ? (int)$convRow['user2_id'] : (int)$convRow['user1_id'];
    
    if ($otherUserId > 0) {
        // The 8 second window accounts for network latency and polling intervals
        // Note: 30-second continuous typing timeout is handled on the frontend
        $typingStmt = $conn->prepare('SELECT ts.is_typing, ua.first_name 
                                    FROM typing_status ts
                                    INNER JOIN user_accounts ua ON ts.user_id = ua.user_id
                                    WHERE ts.conversation_id = ? AND ts.user_id = ? 
                                    AND ts.updated_at > DATE_SUB(NOW(), INTERVAL 8 SECOND)');
        $typingStmt->bind_param('ii', $convId, $otherUserId);
        $typingStmt->execute();
        $typingRes = $typingStmt->get_result();
        
        if ($typingRes && $typingRes->num_rows > 0) {
            $typingRow = $typingRes->fetch_assoc();
            $typingStatus['is_typing'] = (bool)(int)$typingRow['is_typing'];
            if ($typingStatus['is_typing'] && !empty($typingRow['first_name'])) {
                $typingStatus['typing_user_first_name'] = $typingRow['first_name'];
            }
        }
        $typingStmt->close();
    }
}
$convStmt->close();

json_response([
    'success'  => true,
    'conv_id'  => $convId,
    'messages' => $messages, // array of only-new messages
    'typing_status' => $typingStatus, // typing status for other user
    'conversation_status' => $conversationStatus,
    // Keep a one-second overlap so messages/edits sharing a timestamp are not missed.
    'cursor_ts' => max(0, time() - 1),
], 200, JSON_UNESCAPED_SLASHES);
