<?php
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
$conn->set_charset('utf8mb4');
// Keep DB timestamps consistent (optional, remove if you don't use UTC everywhere)
$conn->query("SET time_zone = '+00:00'");

session_start(); // read the PHP session cookie to identify the caller

$userId = (int)($_SESSION['user_id'] ?? 0);
if ($userId <= 0) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Not authenticated']);
    exit;
}

$sql = 'SELECT conv_id, unread_count, first_unread_msg_id
        FROM conversation_participants
        WHERE user_id = ? AND unread_count > 0
        ORDER BY conv_id DESC';

$stmt = $conn->prepare($sql);
if (!$stmt) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Failed to prepare statement']);
    exit;
}

$stmt->bind_param('i', $userId); 
$stmt->execute();                
$res = $stmt->get_result();
if (!$res) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Failed to get result']);
    exit;
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

echo json_encode(['success' => true, 'unreads' => $out], JSON_UNESCAPED_SLASHES);