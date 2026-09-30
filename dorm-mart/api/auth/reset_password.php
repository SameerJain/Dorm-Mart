<?php
declare(strict_types=1);

require_once __DIR__ . '/../helpers/api_bootstrap.php';
init_json_endpoint('POST');

require_once __DIR__ . '/../database/db_connect.php';
require_once __DIR__ . '/../helpers/request.php';
require_once __DIR__ . '/device_history.php';

// Get request data
$ct = $_SERVER['CONTENT_TYPE'] ?? '';
$data = strpos($ct, 'application/json') !== false
    ? json_request_body_or_error(['success' => false, 'error' => 'Invalid JSON payload'])
    : $_POST;
// IMPORTANT: Do NOT HTML-encode passwords before hashing - use raw input
$token = is_string($data['token'] ?? null) ? trim($data['token']) : '';
$newPassword = is_string($data['newPassword'] ?? null) ? $data['newPassword'] : '';
$uid = request_int($data, 'uid');

// Validate inputs
if (!preg_match('/^[a-f0-9]{64}$/D', $token) || $newPassword === '' || $uid <= 0) {
    json_response(['success' => false, 'error' => 'Token, user ID, and new password are required'], 400);
}

// Validate password policy
$MAX_LEN = 64;
if (strlen($newPassword) > $MAX_LEN) {
    json_response(['success' => false, 'error' => 'Password is too long. Maximum length is 64 characters.'], 400);
}

if (!validate_password_policy($newPassword)) {
    json_response(['success' => false, 'error' => 'Password does not meet policy requirements'], 400);
}

$conn = null;
try {
    $conn = db();

    $isValidToken = false;
    $userId = null;
    $verifiedTokenHash = '';
    $isProtected = false;
    $stmt = $conn->prepare('
        SELECT user_id, reset_token_hash, is_protected
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
            $verifiedTokenHash = (string)$row['reset_token_hash'];
            $isProtected = (int)($row['is_protected'] ?? 0) === 1;
        }
    }

    $stmt->close();

    if (!$isValidToken) {
        $conn->close();
        json_response(['success' => false, 'error' => 'Invalid or expired reset token']);
    }

    // Links issued before forgot_password stopped sending them still arrive here.
    if ($isProtected) {
        $conn->close();
        json_response(['success' => false, 'error' => "This shared demo account's password can't be changed."], 403);
    }

    // Hash the new password
    $hashedPassword = hash_password($newPassword);

    // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
    $stmt = $conn->prepare('
        UPDATE user_accounts
        SET hash_pass = ?, hash_auth = NULL, reset_token_hash = NULL,
            reset_token_expires = NULL, last_reset_request = NULL,
            auth_version = auth_version + 1
        WHERE user_id = ? AND reset_token_hash = ?
    ');
    // Matching on the hash we verified makes the token single-use even under
    // concurrent submits: only the first UPDATE finds it still in place.
    $stmt->bind_param('sis', $hashedPassword, $userId, $verifiedTokenHash);
    $stmt->execute();
    $consumed = $stmt->affected_rows > 0;
    $stmt->close();
    $conn->close();
    $conn = null;

    if (!$consumed) {
        // Another submit consumed the token first.
        json_response(['success' => false, 'error' => 'Invalid or expired reset token']);
    }

    mark_all_login_devices_signed_out((int)$userId);

    json_response([
        'success' => true,
        'message' => 'Password has been reset successfully'
    ]);
} catch (Throwable $e) {
    if ($conn instanceof mysqli) {
        try { $conn->close(); } catch (Throwable $_) {}
    }
    error_log('reset_password error: ' . $e->getMessage());
    json_response(['success' => false, 'error' => 'Server error'], 500);
}
