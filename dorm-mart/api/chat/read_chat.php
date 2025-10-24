<?php

declare(strict_types=1);
header('Content-Type: application/json');

// __DIR__ points to api/
require __DIR__ . '/../database/db_connect.php';

require_once __DIR__ . '/../security/security.php';
setSecurityHeaders();
// Ensure CORS headers are present for React dev server and local PHP server
setSecureCORS();

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$conn = db();
$conn->set_charset('utf8mb4');

session_start(); // read the PHP session cookie to identify the caller

// --- auth: require a logged-in user ---
$userId = isset($_SESSION['user_id']) ? (int)$_SESSION['user_id'] : 0;
if ($userId <= 0) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Not authenticated']);
    exit;
}

// --- input: conv_id must come from the query string ---
// e.g. GET /api/read_chat.php?conv_id=123
$convId = isset($_GET['conv_id']) ? (int)$_GET['conv_id'] : 0;
if ($convId <= 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'conv_id is required']);
    exit;
}

// --- verify the user is a participant in this conversation ---
$stmt = $conn->prepare(
    'SELECT 1 FROM conversation_participants WHERE conv_id = ? AND user_id = ? LIMIT 1'
); // prepared statements prevent SQL injection
$stmt->bind_param('ii', $convId, $userId); // 'ii' = two integers
$stmt->execute();
$inConv = $stmt->get_result()->fetch_row(); // returns array or null if no row
$stmt->close();

if (!$inConv) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Not a participant']);
    exit;
}

// --- fetch all messages for this conversation (oldest first) ---
$stmt = $conn->prepare(
    'SELECT message_id, conv_id, sender_id, receiver_id, content, created_at, edited_at
       FROM messages
      WHERE conv_id = ?
      ORDER BY message_id ASC'
);
$stmt->bind_param('i', $convId);
$stmt->execute();
$res = $stmt->get_result(); // requires mysqlnd; if unavailable, switch to bind_result loop
$messages = [];
while ($row = $res->fetch_assoc()) {
    // optionally cast numeric strings to int for cleaner JSON
    $row['message_id'] = (int)$row['message_id'];
    $row['conv_id']    = (int)$row['conv_id'];
    $row['sender_id']  = (int)$row['sender_id'];
    $row['receiver_id']= (int)$row['receiver_id'];
    $messages[] = $row;
}
$stmt->close();

// --- mark as read for the caller (sets "no unread") ---
$stmt = $conn->prepare(
    'UPDATE conversation_participants
        SET unread_count = 0,
            first_unread_msg_id = 0
      WHERE conv_id = ? AND user_id = ?'
);
$stmt->bind_param('ii', $convId, $userId);
$stmt->execute();
$stmt->close();

// --- done ---
echo json_encode([
    'success'  => true,
    'conv_id'  => $convId,
    'count'    => count($messages),
    'messages' => $messages
]);