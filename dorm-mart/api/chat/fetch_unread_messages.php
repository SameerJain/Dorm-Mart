<?php
declare(strict_types=1);
require_once __DIR__ . '/../helpers/api_bootstrap.php';
require_once __DIR__ . '/../auth/auth_handle.php';
require_once __DIR__ . '/../database/db_connect.php';

init_json_endpoint();

$userId = require_login();
// Polled by every open tab; it never writes the session.
session_write_close();

$conn = db();
$conn->set_charset('utf8mb4');

// Conversations the user hid are excluded: counting them made the badge show
// messages the user could not open, and the client kept reloading the list
// looking for them.
$sql = 'SELECT cp.conv_id, cp.unread_count, cp.first_unread_msg_id
          FROM conversation_participants cp
          JOIN conversations c ON c.conv_id = cp.conv_id
         WHERE cp.user_id = ?
           AND cp.unread_count > 0
           AND NOT ((c.user1_id = cp.user_id AND c.user1_deleted = 1)
                 OR (c.user2_id = cp.user_id AND c.user2_deleted = 1))
         ORDER BY cp.conv_id DESC';

$stmt = $conn->prepare($sql);
if (!$stmt) {
    json_response(['success' => false, 'error' => 'Failed to prepare statement'], 500);
}

$stmt->bind_param('i', $userId);
$stmt->execute();
$res = $stmt->get_result();
if (!$res) {
    json_response(['success' => false, 'error' => 'Failed to get result'], 500);
}

$out = [];
while ($row = $res->fetch_assoc()) {
    $out[] = [
        'conv_id' => (int)$row['conv_id'],
        'unread_count' => (int)$row['unread_count'],
        // may be NULL if nothing is unread
        'first_unread_msg_id' => (int)$row['first_unread_msg_id'],
    ];
}

json_response(['success' => true, 'unreads' => $out], 200, JSON_UNESCAPED_SLASHES);
