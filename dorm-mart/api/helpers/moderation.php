<?php
declare(strict_types=1);

// Reports per user per window (message and listing reports share the numbers,
// not the bucket). Generous for real use; stops scripted report floods.
const REPORT_MAX_PER_WINDOW = 10;
const REPORT_WINDOW_MINUTES = 10;
const REPORT_LOCKOUT_MINUTES = 10;

/**
 * Consume one report attempt for this user; responds 429 and exits when over the limit.
 */
function moderation_require_report_quota(string $scope, int $userId): void
{
    $limit = consume_rate_limit(
        scoped_rate_limit_key($scope, $userId),
        REPORT_MAX_PER_WINDOW,
        REPORT_WINDOW_MINUTES,
        REPORT_LOCKOUT_MINUTES
    );
    if ($limit['blocked']) {
        $retryAfterSeconds = max(1, (int)$limit['retry_after_seconds']);
        if (!headers_sent()) {
            header('Retry-After: ' . $retryAfterSeconds);
        }
        json_response([
            'success' => false,
            'error' => 'You have sent a lot of reports recently. Please wait a few minutes and try again.',
        ], 429);
    }
}

/**
 * Record a moderator decision in moderation_actions (migration 028).
 *
 * Best effort by design: the moderation action itself already happened, so a
 * missing table or a failed insert is logged rather than turned into an error.
 *
 * @param array{target_user_id?:int|null,target_type?:string|null,target_id?:int|null,details?:string|null} $context
 */
function moderation_log_action(mysqli $conn, int $moderatorId, string $action, array $context = []): void
{
    try {
        $targetUserId = isset($context['target_user_id']) && (int)$context['target_user_id'] > 0
            ? (int)$context['target_user_id'] : null;
        $targetType = isset($context['target_type']) ? substr((string)$context['target_type'], 0, 20) : null;
        $targetId = isset($context['target_id']) && (int)$context['target_id'] > 0
            ? (int)$context['target_id'] : null;
        $details = isset($context['details']) ? mb_substr((string)$context['details'], 0, 500) : null;
        $action = substr($action, 0, 40);

        $stmt = $conn->prepare(
            'INSERT INTO moderation_actions (moderator_id, action, target_user_id, target_type, target_id, details)
             VALUES (?, ?, ?, ?, ?, ?)'
        );
        if (!$stmt) {
            throw new RuntimeException('prepare failed');
        }
        $stmt->bind_param('isisis', $moderatorId, $action, $targetUserId, $targetType, $targetId, $details);
        $stmt->execute();
        $stmt->close();
    } catch (Throwable $e) {
        error_log('moderation audit log failed (' . $action . '): ' . $e->getMessage());
    }
}

/** True when the user exists and is banned. Unknown users count as not banned. */
function moderation_user_is_banned(mysqli $conn, int $userId): bool
{
    if ($userId <= 0) {
        return false;
    }
    $stmt = $conn->prepare('SELECT is_banned FROM user_accounts WHERE user_id = ? LIMIT 1');
    if (!$stmt) {
        return false;
    }
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    return $row !== null && (int)$row['is_banned'] === 1;
}
