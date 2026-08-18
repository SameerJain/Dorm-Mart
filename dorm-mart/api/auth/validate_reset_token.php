<?php
declare(strict_types=1);

require_once __DIR__ . '/../helpers/api_bootstrap.php';
require_once __DIR__ . '/../helpers/request.php';

init_json_endpoint('POST');

require_once __DIR__ . '/../database/db_connect.php';

$body  = json_request_body();
$token = $body['token'] ?? '';
$uid   = isset($body['uid']) ? (int)$body['uid'] : 0;

if (empty($token) || $uid <= 0) {
    json_response(['success' => false, 'error' => 'Token and user ID required'], 400);
}

try {
    $conn = db();

    $stmt = $conn->prepare('
        SELECT user_id, reset_token_hash
        FROM user_accounts
        WHERE user_id = ?
          AND reset_token_hash IS NOT NULL
          AND reset_token_expires > UTC_TIMESTAMP()
        LIMIT 1
    ');
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare token lookup');
    }
    $stmt->bind_param('i', $uid);
    $stmt->execute();
    $result = $stmt->get_result();

    $isValidToken = false;
    if ($row = $result->fetch_assoc()) {
        $isValidToken = password_verify($token, (string)$row['reset_token_hash']);
    }

    $stmt->close();
    $conn->close();

    if ($isValidToken) {
        json_response(['success' => true, 'valid' => true, 'message' => 'Token is valid']);
    } else {
        json_response(['success' => true, 'valid' => false, 'message' => 'Token is invalid or expired']);
    }

} catch (Exception $e) {
    json_response(['success' => false, 'error' => 'Server error'], 500);
}
