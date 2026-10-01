<?php
// api/chat/fetch_conversations.php
declare(strict_types=1);
require_once __DIR__ . '/../helpers/api_bootstrap.php';
require_once __DIR__ . '/../helpers/inventory.php';
require_once __DIR__ . '/../auth/auth_handle.php';
require_once __DIR__ . '/../database/db_connect.php';

init_json_endpoint();

$conn = db();
$conn->set_charset('utf8mb4');

$userId = require_login();
// Read-only; release the session lock so parallel requests aren't queued.
session_write_close();

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
    inv.item_status AS product_status,
    inv.seller_id AS product_seller_id,
    inv.photos AS product_photos,
    CASE WHEN inv.seller_id <> ? AND seller.reveal_contact_info = 1 THEN seller.email END AS shared_contact_email,
    CASE WHEN inv.seller_id <> ? AND seller.reveal_contact_info = 1 THEN seller.phone_number END AS shared_contact_phone
  FROM conversations c
  LEFT JOIN INVENTORY inv ON inv.product_id = c.product_id
  LEFT JOIN user_accounts seller ON seller.user_id = inv.seller_id
  WHERE (c.user1_id = ? AND c.user1_deleted = 0)
     OR (c.user2_id = ? AND c.user2_deleted = 0)
  -- Most recent activity first (message ids only grow), so a conversation
  -- that gets a new message, or comes back after being hidden, moves to the top.
  ORDER BY COALESCE((SELECT MAX(m.message_id) FROM messages m WHERE m.conv_id = c.conv_id), 0) DESC,
           c.created_at DESC
";

$stmt = $conn->prepare($sql);
if (!$stmt) {
  error_log('fetch_conversations: prepare failed: ' . $conn->error);
  json_response(['success' => false, 'error' => 'Server error'], 500);
}

$stmt->bind_param('iiii', $userId, $userId, $userId, $userId);
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
