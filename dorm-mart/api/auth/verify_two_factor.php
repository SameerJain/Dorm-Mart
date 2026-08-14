<?php

declare(strict_types=1);

require_once __DIR__ . '/../helpers/api_bootstrap.php';
init_json_endpoint('POST', ['ok' => false, 'error' => 'Method Not Allowed']);

require_once __DIR__ . '/auth_handle.php';
require_once __DIR__ . '/../database/db_connect.php';
require_once __DIR__ . '/../helpers/two_factor.php';

auth_boot_session();
$data = json_decode((string)file_get_contents('php://input'), true);
if (!is_array($data)) $data = [];
$code = trim((string)($data['code'] ?? ''));

if (!preg_match('/^\d{6}$/', $code)) {
    json_response(['ok' => false, 'error' => 'Enter the 6-digit verification code.'], 400);
}

$challenge = $_SESSION['two_factor_pending'] ?? null;
if (!is_array($challenge) || empty($challenge['user_id']) || empty($challenge['code_hash'])) {
    json_response(['ok' => false, 'error' => 'Verification session expired. Please log in again.'], 401);
}
if ((int)($challenge['expires_at'] ?? 0) < time()) {
    clear_two_factor_challenge();
    json_response(['ok' => false, 'error' => 'Verification code expired. Please log in again.'], 401);
}

$attempts = (int)($challenge['attempts'] ?? 0) + 1;
$_SESSION['two_factor_pending']['attempts'] = $attempts;
if (!password_verify($code, (string)$challenge['code_hash'])) {
    if ($attempts >= TWO_FACTOR_MAX_ATTEMPTS) {
        clear_two_factor_challenge();
        json_response(['ok' => false, 'error' => 'Too many invalid attempts. Please log in again.'], 429);
    }
    json_response(['ok' => false, 'error' => 'Invalid verification code.'], 401);
}

$userId = (int)$challenge['user_id'];
try {
    $conn = db();
    $stmt = $conn->prepare('SELECT two_factor_enabled, theme, role, is_banned FROM user_accounts WHERE user_id = ? LIMIT 1');
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $user = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    $conn->close();

    if (!$user || !(bool)$user['two_factor_enabled']) {
        clear_two_factor_challenge();
        json_response(['ok' => false, 'error' => 'Two-Factor Authentication is no longer enabled. Please log in again.'], 409);
    }

    if (!empty($user['is_banned'])) {
        clear_two_factor_challenge();
        json_response(['ok' => false, 'error' => 'Account suspended'], 403);
    }

    regenerate_session_on_login();
    clear_two_factor_challenge();
    $_SESSION['user_id'] = $userId;
    record_login_device($userId);
    issue_remember_cookie($userId);

    json_response([
        'ok' => true,
        'message' => 'Login Successful.',
        'theme' => !empty($user['theme']) ? 'dark' : 'light',
        'user_id' => $userId,
        'role' => $user['role'] ?? 'user',
    ]);
} catch (Throwable $e) {
    if (isset($conn) && $conn instanceof mysqli) $conn->close();
    error_log('two-factor verification error: ' . $e->getMessage());
    json_response(['ok' => false, 'error' => 'Server error'], 500);
}
