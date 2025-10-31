<?php

require_once __DIR__ . '/../security/security.php';
setSecurityHeaders();
// Ensure CORS headers are present for React dev server and local PHP server
setSecureCORS();

header('Content-Type: application/json; charset=utf-8');

require __DIR__ . '/../database/db_connect.php';
$conn = db(); // <-- this should return a mysqli connection
$conn->query("SET time_zone = '+00:00'");
$conn->set_charset('utf8mb4');

session_start(); 

$userId = (int)($_SESSION['user_id'] ?? 0);

if ($userId <= 0) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Not authenticated']);
    exit;
}

$convId = isset($_GET['conv_id']) ? (int)$_GET['conv_id'] : 0;
$tsRaw  = isset($_GET['ts']) ? trim((string)$_GET['ts']) : '';

$chk = $conn->prepare(
    'SELECT 1 FROM conversation_participants WHERE conv_id = ? AND user_id = ? LIMIT 1'
);
$chk->bind_param('ii', $convId, $userId); // 'ii' = two integers
$chk->execute();
$inConv = $chk->get_result()->fetch_row(); // array|false
$chk->close();

if (!$inConv) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Not a participant']);
    exit;
}

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
    // Normalize types to what your frontend expects
    $row['message_id']  = (int)$row['message_id'];
    $row['conv_id']     = (int)$row['conv_id'];
    $row['sender_id']   = (int)$row['sender_id'];
    $row['receiver_id'] = (int)$row['receiver_id'];
    $row['content'] = $row['content'];
    $row['created_at'] = $row['created_at'];
    // content, created_at, edited_at are strings (keep as-is)
    $messages[] = $row;
}
$stmt->close();

echo json_encode([
    'success'  => true,
    'conv_id'  => $convId,
    'messages' => $messages, // array of only-new messages
], JSON_UNESCAPED_SLASHES);