<?php

declare(strict_types=1);

require_once __DIR__ . '/../helpers/api_bootstrap.php';
require_once __DIR__ . '/../helpers/request.php';
require_once __DIR__ . '/../auth/auth_handle.php';
require_once __DIR__ . '/../database/db_connect.php';
require_once __DIR__ . '/../helpers/notifications.php';

/**
 * Close the loop with whoever filed the report. Only the first decision is
 * announced (the key is per report), and the message never names the
 * reported user or says what action was taken against them.
 */
function notify_report_outcome(mysqli $conn, int $reportId, string $status): void
{
    try {
        $stmt = $conn->prepare('SELECT reporter_id FROM message_reports WHERE report_id = ? LIMIT 1');
        $stmt->bind_param('i', $reportId);
        $stmt->execute();
        $reporterId = (int)($stmt->get_result()->fetch_assoc()['reporter_id'] ?? 0);
        $stmt->close();
        if ($reporterId <= 0) return;

        $resolved = $status === 'resolved';
        notification_insert($conn, [
            'recipient_user_id' => $reporterId,
            'type' => $resolved ? 'report_resolved' : 'report_dismissed',
            'title' => 'Your report was reviewed',
            'message' => $resolved
                ? 'Thanks for reporting a message. A moderator reviewed it and took action.'
                : 'A moderator reviewed the message you reported and found that it does not break our guidelines.',
            'severity' => $resolved ? 'success' : 'info',
            'metadata' => ['report_id' => $reportId],
            'idempotency_key' => 'report-outcome-' . $reportId,
        ]);
    } catch (Throwable $e) {
        error_log('report outcome notification error: ' . $e->getMessage());
    }
}

init_json_endpoint('POST');
$moderatorId = require_moderator();
$input = json_request_body();
require_csrf_token($input['csrf_token'] ?? null);

$reportId = request_int($input, 'report_id');
$status = is_string($input['status'] ?? null) ? $input['status'] : '';
if ($reportId <= 0 || !in_array($status, ['resolved', 'dismissed'], true)) {
    json_response(['success' => false, 'error' => 'Invalid report update'], 400);
}

try {
    $conn = db();
    $stmt = $conn->prepare('UPDATE message_reports SET status = ?, resolved_at = NOW(), resolved_by = ? WHERE report_id = ?');
    $stmt->bind_param('sii', $status, $moderatorId, $reportId);
    $stmt->execute();
    $updated = $stmt->affected_rows;
    $stmt->close();

    if ($updated === 0) json_response(['success' => false, 'error' => 'Report not found'], 404);
    notify_report_outcome($conn, $reportId, $status);
    json_response(['success' => true, 'report_id' => $reportId, 'status' => $status]);
} catch (Throwable $e) {
    error_log('report resolution error: ' . $e->getMessage());
    json_response(['success' => false, 'error' => 'Server error'], 500);
}
