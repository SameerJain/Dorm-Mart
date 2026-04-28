<?php
declare(strict_types=1);

require_once __DIR__ . '/../helpers/api_bootstrap.php';
require_once __DIR__ . '/../helpers/request.php';

init_json_endpoint('POST');

require_once __DIR__ . '/../database/db_connect.php';

$body  = json_request_body();
$token = $body['token'] ?? '';

if (empty($token)) {
    json_response(['success' => false, 'error' => 'Token required'], 400);
}

try {
    $conn = db();
    
    // Check if token is valid and not expired
    $stmt = $conn->prepare('
        SELECT user_id, hash_auth, reset_token_expires 
        FROM user_accounts 
        WHERE hash_auth IS NOT NULL 
        AND reset_token_expires > NOW()
    ');
    $stmt->execute();
    $result = $stmt->get_result();

    $isValidToken = false;
    $userId = null;
    
    while ($row = $result->fetch_assoc()) {
        if (password_verify($token, $row['hash_auth'])) {
            $isValidToken = true;
            $userId = $row['user_id'];
            break;
        }
    }

    $stmt->close();
    $conn->close();

    if ($isValidToken) {
        json_response([
            'success' => true,
            'valid' => true,
            'user_id' => $userId,
            'message' => 'Token is valid'
        ]);
    } else {
        json_response([
            'success' => true,
            'valid' => false,
            'message' => 'Token is invalid or expired'
        ]);
    }
    
} catch (Exception $e) {
    json_response(['success' => false, 'error' => 'Server error'], 500);
}
