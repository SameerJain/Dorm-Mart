<?php

declare(strict_types=1);

require_once __DIR__ . '/../helpers/api_bootstrap.php';
require_once __DIR__ . '/../helpers/request.php';
require_once __DIR__ . '/../auth/auth_handle.php';
require_once __DIR__ . '/../database/db_connect.php';
require_once __DIR__ . '/../helpers/notifications.php';
require_once __DIR__ . '/../helpers/moderation.php';

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
    // Only an open report can be decided. Without the guard a second click (or
    // a second moderator) silently flipped an earlier decision and overwrote
    // who made it.
    $stmt = $conn->prepare(
        "UPDATE message_reports SET status = ?, resolved_at = NOW(), resolved_by = ?
          WHERE report_id = ? AND status = 'open'"
    );
    $stmt->bind_param('sii', $status, $moderatorId, $reportId);
    $stmt->execute();
    $updated = $stmt->affected_rows;
    $stmt->close();

    $lookup = $conn->prepare('SELECT status, reported_user_id, message_id FROM message_reports WHERE report_id = ? LIMIT 1');
    $lookup->bind_param('i', $reportId);
    $lookup->execute();
    $report = $lookup->get_result()->fetch_assoc();
    $lookup->close();

    if (!$report) json_response(['success' => false, 'error' => 'Report not found'], 404);
    if ($updated === 0) {
        json_response([
            'success' => false,
            'error' => 'This report was already ' . $report['status'] . '.',
            'status' => $report['status'],
        ], 409);
    }

    moderation_log_action($conn, $moderatorId, $status === 'resolved' ? 'resolve_message_report' : 'dismiss_message_report', [
        'target_user_id' => $report['reported_user_id'] ?? null,
        'target_type' => 'message_report',
        'target_id' => $reportId,
        'details' => 'message ' . (int)$report['message_id'],
    ]);
    notify_report_outcome($conn, $reportId, $status);
    json_response(['success' => true, 'report_id' => $reportId, 'status' => $status]);
} catch (Throwable $e) {
    error_log('report resolution error: ' . $e->getMessage());
    json_response(['success' => false, 'error' => 'Server error'], 500);
}
