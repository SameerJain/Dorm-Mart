<?php
// api/chat/fetch_conversations.php
declare(strict_types=1);
require_once __DIR__ . '/../helpers/api_bootstrap.php';
require_once __DIR__ . '/../helpers/inventory.php';
require __DIR__ . '/../database/db_connect.php';

init_json_endpoint();

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
    json_response(['success' => false, 'error' => 'Not authenticated'], 401);
}

$sql = "
  SELECT
    c.conv_id,
    c.user1_id,
    c.user2_id,
    c.user1_fname,
    c.user2_fname,
    c.product_id,
    c.item_deleted,
    inv.title AS product_title,
    inv.seller_id AS product_seller_id,
    inv.photos AS product_photos
  FROM conversations c
  LEFT JOIN INVENTORY inv ON inv.product_id = c.product_id
  WHERE (c.user1_id = ? AND c.user1_deleted = 0)
     OR (c.user2_id = ? AND c.user2_deleted = 0)
  ORDER BY c.created_at DESC
";

$stmt = $conn->prepare($sql);
if (!$stmt) {
  error_log('fetch_conversations: prepare failed: ' . $conn->error);
  json_response(['success' => false, 'error' => 'Server error'], 500);
}

$stmt->bind_param('ii', $userId, $userId); // 'ii' = two integers
$stmt->execute();

$res = $stmt->get_result();          // requires mysqlnd (present in XAMPP)
$rows = $res ? $res->fetch_all(MYSQLI_ASSOC) : [];

// Extract first image from photos JSON for each conversation
// XSS PROTECTION: Escape user-generated content before returning in JSON
foreach ($rows as &$row) {
    $row['product_image_url'] = inventory_first_photo($row['product_photos'] ?? null);
    unset($row['product_photos']); // Remove raw photos JSON from response
    $row['user1_fname'] = $row['user1_fname'] ?? '';
    $row['user2_fname'] = $row['user2_fname'] ?? '';
    $row['product_title'] = $row['product_title'] ?? '';
}

json_response(['success' => true, 'conversations' => $rows]);
