<?php
declare(strict_types=1);
require_once __DIR__ . '/../helpers/api_bootstrap.php';
require __DIR__ . '/../database/db_connect.php';

init_json_endpoint();

$conn = db();
$conn->set_charset('utf8mb4');
// Keep DB timestamps consistent (optional, remove if you don't use UTC everywhere)
$conn->query("SET time_zone = '+00:00'");

session_start(); // read the PHP session cookie to identify the caller

$userId = (int)($_SESSION['user_id'] ?? 0);
if ($userId <= 0) {
    json_response(['success' => false, 'error' => 'Not authenticated'], 401);
}

$sql = 'SELECT conv_id, unread_count, first_unread_msg_id
        FROM conversation_participants
        WHERE user_id = ? AND unread_count > 0
        ORDER BY conv_id DESC';

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
