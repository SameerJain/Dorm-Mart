<?php
declare(strict_types=1);

require_once __DIR__ . '/../helpers/api_bootstrap.php';
require_once __DIR__ . '/../helpers/request.php';

init_json_endpoint('POST');

require_once __DIR__ . '/../database/db_connect.php';

$body  = json_request_body();
$token = $body['token'] ?? '';
$uid   = isset($body['uid']) ? (int)$body['uid'] : 0;

if (empty($token)) {
    json_response(['success' => false, 'error' => 'Token required'], 400);
}

try {
    $conn = db();

    if ($uid > 0) {
        // Fast path: look up the specific user directly
        $stmt = $conn->prepare('
            SELECT user_id, hash_auth
            FROM user_accounts
            WHERE user_id = ?
              AND hash_auth IS NOT NULL
              AND reset_token_expires > NOW()
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
            $isValidToken = password_verify($token, (string)$row['hash_auth']);
        }
    } else {
        // Fallback for old-style links that predate uid in the URL
        $stmt = $conn->prepare('
            SELECT user_id, hash_auth
            FROM user_accounts
            WHERE hash_auth IS NOT NULL
              AND reset_token_expires > NOW()
        ');
        if (!$stmt) {
            throw new RuntimeException('Failed to prepare token lookup');
        }
        $stmt->execute();
        $result = $stmt->get_result();

        $isValidToken = false;
        while ($row = $result->fetch_assoc()) {
            if (password_verify($token, (string)$row['hash_auth'])) {
                $isValidToken = true;
                break;
            }
        }
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
