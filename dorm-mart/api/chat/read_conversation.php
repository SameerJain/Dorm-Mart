<?php
// api/list-user-conversations.php

require_once __DIR__ . '/../security/security.php';
setSecurityHeaders();
// Ensure CORS headers are present for React dev server and local PHP server
setSecureCORS();

header('Content-Type: application/json; charset=utf-8');

require __DIR__ . '/../database/db_connect.php';
$mysqli = db(); // <-- this should return a mysqli connection

$uid = filter_input(INPUT_GET, 'user_id', FILTER_VALIDATE_INT);
if (!$uid) {
  http_response_code(400);
  echo json_encode(['success' => false, 'error' => 'Missing or invalid user_id']);
  exit;
}

$sql = "
  SELECT
    conv_id,
    user1_id,
    user2_id,
    user1_fname,
    user2_fname,
    user1_deleted,
    user2_deleted,
    created_at
  FROM conversations
  WHERE (user1_id = ? AND user1_deleted = 0)
     OR (user2_id = ? AND user2_deleted = 0)
  ORDER BY created_at DESC
";

$stmt = $mysqli->prepare($sql);
if (!$stmt) {
  http_response_code(500);
  echo json_encode(['success' => false, 'error' => 'Prepare failed', 'detail' => $mysqli->error]);
  exit;
}

$stmt->bind_param('ii', $uid, $uid); // 'ii' = two integers
$stmt->execute();

$res = $stmt->get_result();          // requires mysqlnd (present in XAMPP)
$rows = $res ? $res->fetch_all(MYSQLI_ASSOC) : [];

echo json_encode(['success' => true, 'conversations' => $rows]);
