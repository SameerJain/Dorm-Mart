<?php

declare(strict_types=1);

require_once __DIR__ . '/../helpers/api_bootstrap.php';
require_once __DIR__ . '/../helpers/request.php';
require_once __DIR__ . '/../auth/auth_handle.php';
require_once __DIR__ . '/../database/db_connect.php';

init_json_endpoint('POST');
$moderatorId = require_moderator();
$input = json_request_body();
require_csrf_token($input['csrf_token'] ?? null);

$targetId = request_int($input, 'user_id');
$shouldBan = strict_boolean_value($input['banned'] ?? true);
$reasonValue = $input['reason'] ?? 'Moderator action';
$reason = is_string($reasonValue) ? trim($reasonValue) : '';

if ($targetId <= 0 || $targetId === $moderatorId || $shouldBan === null || $reason === '') {
    json_response(['success' => false, 'error' => 'Invalid user'], 400);
}
if ((function_exists('mb_strlen') ? mb_strlen($reason, 'UTF-8') : strlen($reason)) > 255) {
    json_response(['success' => false, 'error' => 'Reason is too long'], 400);
}

try {
    $conn = db();
    $stmt = $conn->prepare('SELECT role FROM user_accounts WHERE user_id = ? LIMIT 1');
    $stmt->bind_param('i', $targetId);
    $stmt->execute();
    $target = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (!$target) json_response(['success' => false, 'error' => 'User not found'], 404);
    if ($target['role'] === 'moderator') {
        json_response(['success' => false, 'error' => 'Moderator accounts cannot be banned here'], 409);
    }

    if ($shouldBan) {
        $stmt = $conn->prepare(
            'UPDATE user_accounts
             SET is_banned = 1, banned_at = UTC_TIMESTAMP(), ban_reason = ?,
                 hash_auth = NULL, reset_token_hash = NULL, reset_token_expires = NULL,
                 last_reset_request = NULL, auth_version = auth_version + 1
             WHERE user_id = ?'
        );
        $stmt->bind_param('si', $reason, $targetId);
    } else {
        $stmt = $conn->prepare('UPDATE user_accounts SET is_banned = 0, banned_at = NULL, ban_reason = NULL WHERE user_id = ?');
        $stmt->bind_param('i', $targetId);
    }
    $stmt->execute();
    $stmt->close();

    if ($shouldBan) {
        mark_all_login_devices_signed_out($targetId);
    }

    json_response(['success' => true, 'user_id' => $targetId, 'is_banned' => $shouldBan]);
} catch (Throwable $e) {
    error_log('moderation ban error: ' . $e->getMessage());
    json_response(['success' => false, 'error' => 'Server error'], 500);
}
