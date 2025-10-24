<?php


// __DIR__ points to api/
require __DIR__ . '/../database/db_connect.php';

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$conn = db();


$body = json_decode(file_get_contents('php://input'), true);
$sender   = isset($body['sender_id'])   ? trim((string)$body['sender_id'])   : '';
$receiver = isset($body['receiver_id']) ? trim((string)$body['receiver_id']) : '';
$text     = isset($body['text'])        ? trim((string)$body['text'])        : '';

if ($sender === '' || $receiver === '' || $text === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'missing_fields']);
    exit;
}

$sql = ""


