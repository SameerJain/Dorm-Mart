<?php
// api/list-user-conversations.php
declare(strict_types=1);
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

/*
login.php
- creates a new session file and updates the cookie
- PHP sends Set-Cookie
- Subsequent API calls send the cookie automatically
session_start();
if ($okPassword) {
  session_regenerate_id(true); // prevent fixation; gives a fresh session id
  $_SESSION['user_id'] = $user['user_id'];
  echo json_encode(['success' => true]);
}
*/
// reads PHPSESSID from Cookie header and loads that session
session_start(); 
$userId = (int)($_SESSION['user_id'] ?? 0);

if ($userId <= 0) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Not authenticated']);
    exit;
}

$sql = "
  SELECT
    conv_id,
    user1_id,
    user2_id,
    user1_fname,
    user2_fname
  FROM conversations
  WHERE (user1_id = ? AND user1_deleted = 0)
     OR (user2_id = ? AND user2_deleted = 0)
  ORDER BY created_at DESC
";

$stmt = $conn->prepare($sql);
if (!$stmt) {
  http_response_code(500);
  echo json_encode(['success' => false, 'error' => 'Prepare failed', 'detail' => $db->error]);
  exit;
}

$stmt->bind_param('ii', $userId, $userId); // 'ii' = two integers
$stmt->execute();

$res = $stmt->get_result();          // requires mysqlnd (present in XAMPP)
$rows = $res ? $res->fetch_all(MYSQLI_ASSOC) : [];

echo json_encode(['success' => true, 'conversations' => $rows]);
