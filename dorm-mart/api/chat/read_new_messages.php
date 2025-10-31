<?php

header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../security/security.php';
require __DIR__ . '/../database/db_connect.php';
setSecurityHeaders();
// Ensure CORS headers are present for React dev server and local PHP server
setSecureCORS();

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$conn = db();

session_start(); 
$userId = (int)($_SESSION['user_id'] ?? 0);
if ($userId <= 0) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Not authenticated']);
    exit;
}

$convId = isset($_GET['conv_id']) ? (int)$_GET['conv_id'] : 0;
$tsRaw  = isset($_GET['ts']) ? trim((string)$_GET['ts']) : '';

$stmt = $conn->prepare(
    'SELECT
         message_id, conv_id, sender_id, receiver_id, content,
         created_at, edited_at,
         DATE_FORMAT(created_at, "%Y-%m-%dT%H:%i:%sZ") AS created_at,  -- ISO UTC
         DATE_FORMAT(edited_at,  "%Y-%m-%dT%H:%i:%sZ") AS edited_at    -- ISO UTC (NULL stays NULL)
       FROM messages
      WHERE conv_id = ?
        AND created_at > ?
      ORDER BY message_id ASC'
);
// 'is' = integer (conv_id), string (ts as DATETIME in UTC)
$stmt->bind_param('is', $convId, $tsRaw);
$stmt->execute();

$res = $stmt->get_result(); // requires mysqlnd; otherwise switch to bind_result loop
$messages = [];
while ($row = $res->fetch_assoc()) {
    $messages[] = $row;   // use row as-is
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

echo json_encode([
    'success'  => true,
    'conv_id'  => $convId,
    'messages' => $messages, // array of only-new messages
], JSON_UNESCAPED_SLASHES);