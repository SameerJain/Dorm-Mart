<?php
declare(strict_types=1);

// Include security headers for XSS protection
require_once __DIR__ . '/../security/security.php';
setSecurityHeaders();

header('Content-Type: application/json; charset=utf-8');

// SECURE CORS Configuration
setSecureCORS();

require_once __DIR__ . '/../database/db_connect.php';

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method Not Allowed']);
    exit;
}

// Get request data
$ct = $_SERVER['CONTENT_TYPE'] ?? '';
if (strpos($ct, 'application/json') !== false) {
    $raw = file_get_contents('php://input');
    $data = sanitize_json($raw) ?: [];
    $token = sanitize_string((string)($data['token'] ?? ''), 128);
    $newPassword = sanitize_string((string)($data['newPassword'] ?? ''), 64);
} else {
    $token = sanitize_string((string)($_POST['token'] ?? ''), 128);
    $newPassword = sanitize_string((string)($_POST['newPassword'] ?? ''), 64);
}

// Validate inputs
if ($token === '' || $newPassword === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing required fields']);
    exit;
}

if (strlen($newPassword) > 64) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Password is too long']);
    exit;
}

if (strlen($newPassword) < 8
    || !preg_match('/[a-z]/', $newPassword)
    || !preg_match('/[A-Z]/', $newPassword)
    || !preg_match('/\d/', $newPassword)
    || !preg_match('/[^A-Za-z0-9]/', $newPassword)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Password does not meet policy']);
    exit;
}

try {
    $conn = db();
    
    // Find user with valid token
    $stmt = $conn->prepare('
        SELECT user_id, hash_auth, reset_token_expires 
        FROM user_accounts 
        WHERE hash_auth IS NOT NULL 
        AND reset_token_expires > NOW()
    ');
    $stmt->execute();
    $result = $stmt->get_result();
    
    $userId = null;
    while ($row = $result->fetch_assoc()) {
        if (password_verify($token, $row['hash_auth'])) {
            $userId = $row['user_id'];
            break;
        }
    }
    
    $stmt->close();
    
    if (!$userId) {
        $conn->close();
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid or expired reset token']);
        exit;
    }
    
    // Hash the new password
    $newHash = password_hash($newPassword, PASSWORD_BCRYPT);
    
    // Update password and clear reset token
    $stmt = $conn->prepare('UPDATE user_accounts SET hash_pass = ?, hash_auth = NULL, reset_token_expires = NULL WHERE user_id = ?');
    $stmt->bind_param('si', $newHash, $userId);
    $stmt->execute();
    $stmt->close();
    
    $conn->close();
    
    echo json_encode(['success' => true, 'message' => 'Password reset successfully']);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Internal server error']);
}
?>
