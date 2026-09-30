<?php

declare(strict_types=1);

require_once __DIR__ . '/../helpers/api_bootstrap.php';
init_json_endpoint('POST');

require_once __DIR__ . '/../config/app_config.php';
require_once __DIR__ . '/../helpers/request.php';
require_once __DIR__ . '/../helpers/email.php';
require_once __DIR__ . '/../database/db_connect.php';

const PASSWORD_RESET_ACCEPTED_MESSAGE = 'If this email is registered, a reset link has been sent.';
$passwordResetStartedAt = microtime(true);

/** Every outcome answers identically after the same delay, so none reveals whether the email is registered. */
function accept_password_reset_request(): void
{
    global $passwordResetStartedAt;
    json_response_after($passwordResetStartedAt, 2.0, [
        'success' => true,
        'message' => PASSWORD_RESET_ACCEPTED_MESSAGE,
    ], 202);
}

function restore_password_reset_state(mysqli $conn, array $user, string $requestId): bool
{
    try {
        $oldHash = $user['reset_token_hash'] ?? null;
        $oldExpires = $user['reset_token_expires'] ?? null;
        $oldRequested = $user['last_reset_request'] ?? null;
        $userId = (int)$user['user_id'];
        $stmt = $conn->prepare(
            'UPDATE user_accounts SET reset_token_hash = ?, reset_token_expires = ?, last_reset_request = ? WHERE user_id = ?'
        );
        $stmt->bind_param('sssi', $oldHash, $oldExpires, $oldRequested, $userId);
        $stmt->execute();
        $restored = $stmt->affected_rows >= 0;
        $stmt->close();
        dm_log_auth_event('forgot_password', $requestId, $restored ? 'token_cleanup_succeeded' : 'token_cleanup_failed', [
            'user_id' => $userId,
        ]);
        return $restored;
    } catch (Throwable $e) {
        dm_log_auth_event('forgot_password', $requestId, 'token_cleanup_failed', [
            'user_id' => (int)($user['user_id'] ?? 0),
            'error' => $e->getMessage(),
        ]);
        return false;
    }
}

// Get request data
$ct = $_SERVER['CONTENT_TYPE'] ?? '';
$data = strpos($ct, 'application/json') !== false
    ? json_request_body_or_error(['success' => false, 'error' => 'Invalid JSON payload'])
    : $_POST;
$emailRaw = is_string($data['email'] ?? null) ? strtolower(trim($data['email'])) : '';

// Load email policy configuration
require_once __DIR__ . '/../config/email_config.php';

// Email validation based on ALLOW_ALL_EMAILS flag
if (ALLOW_ALL_EMAILS) {
    // Accept any valid email format
    $email = validate_input($emailRaw, 255, '/^[^@\s]+@[^@\s]+\.[^@\s]+$/');
    if ($email === false || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        json_response(['success' => false, 'error' => 'Invalid email format'], 400);
    }
} else {
    // Only accept @buffalo.edu
    $email = validate_input($emailRaw, 255, '/^[^@\s]+@buffalo\.edu$/');
    if ($email === false || !preg_match('/^[^@\s]+@buffalo\.edu$/', $email)) {
        json_response(['success' => false, 'error' => 'Email must be @buffalo.edu'], 400);
    }
}

$emailLocalPart = explode('@', $email)[0] ?? '';
if (preg_match('/^\d+$/', $emailLocalPart)) {
    json_response(['success' => false, 'error' => 'Invalid email format'], 400);
}

$requestId = bin2hex(random_bytes(8));
try {
    $conn = db();

    // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
    $stmt = $conn->prepare('SELECT user_id, first_name, last_name, email, reset_token_hash, reset_token_expires, last_reset_request, is_protected FROM user_accounts WHERE email = ?');
    $stmt->bind_param('s', $email);  // 's' = string type, safely bound as parameter
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows === 0) {
        $stmt->close();
        $conn->close();
        dm_log_auth_event('forgot_password', $requestId, 'unknown_request');
        accept_password_reset_request();
    }

    $user = $result->fetch_assoc();
    $stmt->close();

    // Shared demo accounts keep a fixed password (change_password refuses too).
    // Answer exactly as for an unknown address so this does not reveal them.
    if ((int)($user['is_protected'] ?? 0) === 1) {
        $conn->close();
        dm_log_auth_event('forgot_password', $requestId, 'protected_account');
        accept_password_reset_request();
    }

    // Generate reset token (same as login system)
    $resetToken = bin2hex(random_bytes(32));
    $hashedToken = password_hash($resetToken, PASSWORD_BCRYPT);

    // Set expiration to 1 hour from now using UTC timezone
    $expiresAt = (new DateTime('+1 hour', new DateTimeZone('UTC')))->format('Y-m-d H:i:s');

    // Claim the ten-minute window and store the token in a single conditional write.
    // Reading last_reset_request and then updating it would let concurrent requests
    // all observe the same stale timestamp, all pass the check, and all send an
    // email; letting the database decide who wins makes that impossible.
    // The prior state is kept in $user so a rejected email can be compensated
    // without holding a transaction open during the provider request.
    $stmt = $conn->prepare(
        'UPDATE user_accounts
         SET reset_token_hash = ?, reset_token_expires = ?, last_reset_request = NOW()
         WHERE user_id = ?
           AND (last_reset_request IS NULL
                OR last_reset_request < DATE_SUB(NOW(), INTERVAL 10 MINUTE))'
    );
    $stmt->bind_param('ssi', $hashedToken, $expiresAt, $user['user_id']);
    $stmt->execute();
    $claimed = $stmt->affected_rows === 1;
    $stmt->close();

    if (!$claimed) {
        $conn->close();
        dm_log_auth_event('forgot_password', $requestId, 'rate_limited', ['user_id' => (int)$user['user_id']]);
        accept_password_reset_request();
    }
    $resetTokenStored = true;

    $resetLink = dm_api_url('redirects/handle_password_reset_token_redirect.php') . '?token=' . urlencode($resetToken) . '&uid=' . (int)$user['user_id'];

    $emailResult = dm_send_email(
        [
            'email' => (string)$user['email'],
            'firstName' => (string)($user['first_name'] ?? ''),
            'lastName' => (string)($user['last_name'] ?? ''),
        ],
        dm_transactional_password_reset_package($user['first_name'] ?? '', $resetLink)
    );

    if (!$emailResult['ok']) {
        dm_log_auth_event('forgot_password', $requestId, 'delivery_failed', [
            'user_id' => (int)$user['user_id'],
            'error' => $emailResult['error'] ?? 'Unknown error',
        ]);
        restore_password_reset_state($conn, $user, $requestId);
        $resetTokenStored = false;
        $conn->close();
        accept_password_reset_request();
    }

    $conn->close();
    $resetTokenStored = false;
    dm_log_auth_event('forgot_password', $requestId, 'accepted', ['user_id' => (int)$user['user_id']]);
    accept_password_reset_request();
} catch (Throwable $e) {
    dm_log_auth_event('forgot_password', $requestId, 'internal_error', ['error' => $e->getMessage()]);
    if (isset($conn) && $conn instanceof mysqli) {
        if (!empty($resetTokenStored) && isset($user) && is_array($user)) {
            restore_password_reset_state($conn, $user, $requestId);
        }
        $conn->close();
    }
    accept_password_reset_request();
}
