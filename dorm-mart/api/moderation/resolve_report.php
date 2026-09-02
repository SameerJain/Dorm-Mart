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
    json_response(['success' => true, 'report_id' => $reportId, 'status' => $status]);
} catch (Throwable $e) {
    error_log('report resolution error: ' . $e->getMessage());
    json_response(['success' => false, 'error' => 'Server error'], 500);
}
