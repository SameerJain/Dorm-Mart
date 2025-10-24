<?php
declare(strict_types=1);

// Include security headers for XSS protection
require_once __DIR__ . '/../security/security.php';
setSecurityHeaders();
setSecureCORS();

header('Content-Type: application/json; charset=utf-8');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Only allow GET requests
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method Not Allowed']);
    exit;
}

require_once __DIR__ . '/../database/db_connect.php';

$token = $_GET['token'] ?? '';

if (empty($token)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Token required']);
    exit;
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
        echo json_encode([
            'success' => true,
            'valid' => true,
            'user_id' => $userId,
            'message' => 'Token is valid'
        ]);
    } else {
        echo json_encode([
            'success' => true,
            'valid' => false,
            'message' => 'Token is invalid or expired'
        ]);
    }
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Server error']);
}
?>


