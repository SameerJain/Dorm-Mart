<?php
declare(strict_types=1);

// Include security headers for XSS protection
require_once __DIR__ . '/../security/security.php';
dm_enforce_https();
set_security_headers();
set_secure_cors();

header('Content-Type: application/json; charset=utf-8');

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

require_once __DIR__ . '/../database/db_connect.php';
require_once __DIR__ . '/../helpers/request.php';
require_once __DIR__ . '/device_history.php';

// Get request data
$ct = $_SERVER['CONTENT_TYPE'] ?? '';
if (strpos($ct, 'application/json') !== false) {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        $data = [];
    }
    // IMPORTANT: Do NOT HTML-encode passwords before hashing - use raw input
    $token = isset($data['token']) ? trim((string)$data['token']) : '';
    $newPassword = isset($data['newPassword']) ? (string)$data['newPassword'] : '';
    $uid = isset($data['uid']) ? (int)$data['uid'] : 0;
} else {
    // IMPORTANT: Do NOT HTML-encode passwords before hashing - use raw input
    $token = isset($_POST['token']) ? trim((string)$_POST['token']) : '';
    $newPassword = isset($_POST['newPassword']) ? (string)$_POST['newPassword'] : '';
    $uid = isset($_POST['uid']) ? (int)$_POST['uid'] : 0;
}

// Validate inputs
if (empty($token) || empty($newPassword) || $uid <= 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Token, user ID, and new password are required']);
    exit;
}

// Validate password policy
$MAX_LEN = 64;
if (strlen($newPassword) > $MAX_LEN) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Password is too long. Maximum length is 64 characters.']);
    exit;
}

if (!validate_password_policy($newPassword)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Password does not meet policy requirements']);
    exit;
}

try {
    $conn = db();
    
    $isValidToken = false;
    $userId = null;
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
    if ($row = $result->fetch_assoc()) {
        if (password_verify($token, (string)$row['reset_token_hash'])) {
            $isValidToken = true;
            $userId = (int)$row['user_id'];
        }
    }

    $stmt->close();

    if (!$isValidToken) {
        $conn->close();
        echo json_encode(['success' => false, 'error' => 'Invalid or expired reset token']);
        exit;
    }

    // Hash the new password
    $hashedPassword = password_hash($newPassword, PASSWORD_BCRYPT);

    // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
    $stmt = $conn->prepare('
        UPDATE user_accounts 
        SET hash_pass = ?, hash_auth = NULL, reset_token_hash = NULL,
            reset_token_expires = NULL, last_reset_request = NULL,
            auth_version = auth_version + 1
        WHERE user_id = ?
    ');
    $stmt->bind_param('si', $hashedPassword, $userId);  // 's' = string, 'i' = integer
    $stmt->execute();
    
    if ($stmt->affected_rows === 0) {
        $stmt->close();
        $conn->close();
        echo json_encode(['success' => false, 'error' => 'Failed to update password']);
        exit;
    }

    $stmt->close();
    $conn->close();
    mark_all_login_devices_signed_out((int)$userId);

    echo json_encode([
        'success' => true,
        'message' => 'Password has been reset successfully'
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Server error']);
}
?>
