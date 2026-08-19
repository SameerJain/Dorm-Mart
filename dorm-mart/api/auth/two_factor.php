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
        'SELECT first_name, last_name, email, hash_pass, two_factor_enabled
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
        if ((bool)$user['two_factor_enabled']) {
            $conn->close();
            json_response(['ok' => false, 'error' => 'Two-Factor Authentication is already enabled for this account.'], 409);
        }

        $update = $conn->prepare('UPDATE user_accounts SET two_factor_enabled = 1 WHERE user_id = ?');
        $update->bind_param('i', $userId);
        $update->execute();
        $update->close();

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
        if (!password_verify($password, (string)$user['hash_pass'])) {
            $conn->close();
            json_response(['ok' => false, 'error' => 'Invalid current password.'], 401);
        }

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
