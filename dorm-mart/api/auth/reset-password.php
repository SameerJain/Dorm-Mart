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

// Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method Not Allowed']);
    exit;
}

require_once __DIR__ . '/../database/db_connect.php';

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
} else {
    // IMPORTANT: Do NOT HTML-encode passwords before hashing - use raw input
    $token = isset($_POST['token']) ? trim((string)$_POST['token']) : '';
    $newPassword = isset($_POST['newPassword']) ? (string)$_POST['newPassword'] : '';
}

// Validate inputs
if (empty($token) || empty($newPassword)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Token and new password are required']);
    exit;
}

// Validate password policy
$MAX_LEN = 64;
if (strlen($newPassword) > $MAX_LEN) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Password is too long. Maximum length is 64 characters.']);
    exit;
}

if (
    strlen($newPassword) < 8
    || !preg_match('/[a-z]/', $newPassword)
    || !preg_match('/[A-Z]/', $newPassword)
    || !preg_match('/\d/', $newPassword)
    || !preg_match('/[^A-Za-z0-9]/', $newPassword)
) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Password does not meet policy requirements']);
    exit;
}

try {
    $conn = db();
    
    // ============================================================================
    // SQL INJECTION PROTECTION: Prepared Statement (No User Input in Query)
    // ============================================================================
    // This query contains no user input - it checks all reset tokens and uses
    // password_verify() to validate the token. The token comparison happens
    // in PHP using password_verify(), not in SQL, so SQL injection is not possible.
    // ============================================================================
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

    if (!$isValidToken) {
        $conn->close();
        echo json_encode(['success' => false, 'error' => 'Invalid or expired reset token']);
        exit;
    }

    // Hash the new password
    $hashedPassword = password_hash($newPassword, PASSWORD_BCRYPT);

    // ============================================================================
    // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
    // ============================================================================
    // The password hash and user_id are bound as parameters using bind_param().
    // Even if malicious SQL were somehow in the hash or user_id, it cannot execute
    // because it's bound as a parameter, not concatenated into SQL.
    // ============================================================================
    $stmt = $conn->prepare('
        UPDATE user_accounts 
        SET hash_pass = ?, hash_auth = NULL, reset_token_expires = NULL 
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

    echo json_encode([
        'success' => true,
        'message' => 'Password has been reset successfully'
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Server error']);
}
?>
