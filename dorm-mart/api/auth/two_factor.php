<?php

declare(strict_types=1);

require_once __DIR__ . '/../helpers/api_bootstrap.php';
init_json_endpoint();

require_once __DIR__ . '/auth_handle.php';
require_once __DIR__ . '/../database/db_connect.php';
require_once __DIR__ . '/../helpers/two_factor.php';
require_once __DIR__ . '/../helpers/request.php';

$userId = require_login();
$method = $_SERVER['REQUEST_METHOD'] ?? '';

try {
    $conn = db();
    $stmt = $conn->prepare(
        'SELECT first_name, last_name, email, hash_pass, two_factor_enabled, is_protected
         FROM user_accounts WHERE user_id = ? LIMIT 1'
    );
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $user = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (!$user) {
        $conn->close();
        json_response(['ok' => false, 'error' => 'User not found'], 404);
    }

    if ($method === 'GET') {
        $conn->close();
        json_response([
            'ok' => true,
            'enabled' => (bool)$user['two_factor_enabled'],
            'email' => mask_two_factor_email((string)$user['email']),
        ]);
    }

    if ($method !== 'POST') {
        $conn->close();
        json_response(['ok' => false, 'error' => 'Method Not Allowed'], 405);
    }

    $data = json_request_body_or_error(['ok' => false, 'error' => 'Invalid JSON payload']);
    require_csrf_token($data['csrf_token'] ?? null);
    $action = is_string($data['action'] ?? null) ? $data['action'] : '';

    if ($action === 'enable') {
        // Seeded demo accounts are shared and their inboxes are not real; turning
        // 2FA on would lock every other tester out of the account.
        if ((int)($user['is_protected'] ?? 0) === 1) {
            $conn->close();
            json_response(['ok' => false, 'error' => "Two-Factor Authentication can't be turned on for this shared demo account."], 403);
        }
        if ((bool)$user['two_factor_enabled']) {
            $conn->close();
            json_response(['ok' => false, 'error' => 'Two-Factor Authentication is already enabled for this account.'], 409);
        }

        // Each enable emails a confirmation; cap it so toggling 2FA off and on
        // cannot be used to flood the inbox (or burn the email-provider quota).
        $enableLimit = consume_rate_limit(
            scoped_rate_limit_key('two_factor_enable_email', $userId),
            TWO_FACTOR_ENABLE_EMAILS_PER_WINDOW,
            TWO_FACTOR_ENABLE_WINDOW_MINUTES,
            TWO_FACTOR_ENABLE_LOCKOUT_MINUTES
        );
        if ($enableLimit['blocked']) {
            $conn->close();
            $retryAfterSeconds = max(1, (int)$enableLimit['retry_after_seconds']);
            $displayMinutes = rate_limit_retry_minutes($retryAfterSeconds);
            header('Retry-After: ' . $retryAfterSeconds);
            json_response([
                'ok' => false,
                'error' => "Two-Factor Authentication was turned on too many times recently. Please try again in {$displayMinutes} minute"
                    . ($displayMinutes > 1 ? 's' : '') . '.',
            ], 429);
        }

        // Conditional flip: of two concurrent enables only one changes the row, so
        // only one sends the confirmation email.
        $update = $conn->prepare('UPDATE user_accounts SET two_factor_enabled = 1 WHERE user_id = ? AND two_factor_enabled = 0');
        $update->bind_param('i', $userId);
        $update->execute();
        $flipped = $update->affected_rows === 1;
        $update->close();
        if (!$flipped) {
            $conn->close();
            json_response(['ok' => false, 'error' => 'Two-Factor Authentication is already enabled for this account.'], 409);
        }

        $mailResult = send_two_factor_email(
            $user,
            dm_transactional_two_factor_enabled_package((string)$user['first_name'])
        );
        if (!$mailResult['ok']) {
            $rollback = $conn->prepare('UPDATE user_accounts SET two_factor_enabled = 0 WHERE user_id = ?');
            $rollback->bind_param('i', $userId);
            $rollback->execute();
            $rollback->close();
            $conn->close();
            error_log('Two-factor enable email failed for user_id ' . $userId . ': ' . ($mailResult['error'] ?? 'unknown error'));
            json_response(['ok' => false, 'error' => 'Unable to send the confirmation email. Two-Factor Authentication was not enabled.'], 502);
        }

        $conn->close();
        clear_remember_cookie($userId);
        json_response([
            'ok' => true,
            'enabled' => true,
            'message' => 'Two-Factor Authentication Enabled Successfully.',
        ]);
    }

    if ($action === 'disable') {
        if (!(bool)$user['two_factor_enabled']) {
            $conn->close();
            json_response(['ok' => false, 'error' => 'Two-Factor Authentication is not enabled for this account.'], 409);
        }

        $password = is_string($data['password'] ?? null) ? $data['password'] : '';
        if ($password === '' || strlen($password) > 64) {
            $conn->close();
            json_response(['ok' => false, 'error' => 'Enter your current account password.'], 400);
        }

        $passwordLimit = consume_password_confirm_attempt($userId);
        if ($passwordLimit['blocked']) {
            $conn->close();
            json_response(password_confirm_retry_error($passwordLimit), 429);
        }

        if (!password_verify($password, (string)$user['hash_pass'])) {
            $conn->close();
            json_response(['ok' => false, 'error' => 'Invalid current password.'], 401);
        }
        clear_password_confirm_attempts($userId);

        $update = $conn->prepare('UPDATE user_accounts SET two_factor_enabled = 0 WHERE user_id = ?');
        $update->bind_param('i', $userId);
        $update->execute();
        $update->close();
        $conn->close();
        clear_two_factor_challenge();

        json_response([
            'ok' => true,
            'enabled' => false,
            'message' => 'Two-Factor Authentication Disabled Successfully.',
        ]);
    }

    $conn->close();
    json_response(['ok' => false, 'error' => 'Invalid action'], 400);
} catch (Throwable $e) {
    if (isset($conn) && $conn instanceof mysqli) $conn->close();
    error_log('two_factor settings error: ' . $e->getMessage());
    json_response(['ok' => false, 'error' => 'Server error'], 500);
}
