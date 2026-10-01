<?php

declare(strict_types=1);

require_once __DIR__ . '/../helpers/api_bootstrap.php';
require_once __DIR__ . '/../helpers/request.php';
require_once __DIR__ . '/../auth/auth_handle.php';
require_once __DIR__ . '/../database/db_connect.php';
require_once __DIR__ . '/../helpers/moderation.php';
require_once __DIR__ . '/../scheduled_purchases/helpers.php';

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

    $conn->begin_transaction();
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

    // A banned user cannot log in to show up or answer, so nobody should keep
    // waiting on a meetup with them. Unbanning restores nothing here: their
    // listings reappear on their own, but cancelled schedules stay cancelled.
    $cancelledSchedules = $shouldBan
        ? scheduled_purchase_cancel_all_for_user(
            $conn,
            $targetId,
            'This scheduled purchase was cancelled because the other user is no longer active on Dorm Mart.'
        )
        : 0;
    $conn->commit();

    moderation_log_action($conn, $moderatorId, $shouldBan ? 'ban_user' : 'unban_user', [
        'target_user_id' => $targetId,
        'target_type' => 'user',
        'target_id' => $targetId,
        'details' => $shouldBan ? $reason . ' (' . $cancelledSchedules . ' scheduled purchases cancelled)' : $reason,
    ]);

    if ($shouldBan) {
        mark_all_login_devices_signed_out($targetId);
    }

    json_response([
        'success' => true,
        'user_id' => $targetId,
        'is_banned' => $shouldBan,
        'cancelled_schedules' => $cancelledSchedules,
    ]);
} catch (Throwable $e) {
    if (isset($conn) && $conn instanceof mysqli) { try { $conn->rollback(); } catch (Throwable $_) {} }
    error_log('moderation ban error: ' . $e->getMessage());
    json_response(['success' => false, 'error' => 'Server error'], 500);
}
