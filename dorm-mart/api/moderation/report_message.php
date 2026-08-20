<?php

declare(strict_types=1);

require_once __DIR__ . '/../helpers/api_bootstrap.php';
require_once __DIR__ . '/../helpers/request.php';
require_once __DIR__ . '/../auth/auth_handle.php';
require_once __DIR__ . '/../database/db_connect.php';

init_json_endpoint('POST');
$reporterId = require_login();
$input = json_request_body();
require_csrf_token($input['csrf_token'] ?? null);

$messageId = request_int($input, 'message_id');
$reasonValue = $input['reason'] ?? 'Inappropriate or unsafe content';
$reason = is_string($reasonValue) ? trim($reasonValue) : '';
$reasonLength = function_exists('mb_strlen') ? mb_strlen($reason, 'UTF-8') : strlen($reason);
if ($messageId <= 0 || $reason === '' || $reasonLength > 255) {
    json_response(['success' => false, 'error' => 'Invalid report'], 400);
}

try {
    $conn = db();
    $stmt = $conn->prepare(
        'SELECT m.sender_id
           FROM messages m
           JOIN conversations c ON c.conv_id = m.conv_id
          WHERE m.message_id = ? AND (c.user1_id = ? OR c.user2_id = ?)
          LIMIT 1'
    );
    $stmt->bind_param('iii', $messageId, $reporterId, $reporterId);
    $stmt->execute();
    $message = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (!$message) json_response(['success' => false, 'error' => 'Message not found'], 404);
    $reportedUserId = (int)($message['sender_id'] ?? 0);
    if ($reportedUserId <= 0 || $reportedUserId === $reporterId) {
        json_response(['success' => false, 'error' => 'You cannot report this message'], 409);
    }

    $stmt = $conn->prepare(
        'INSERT INTO message_reports (message_id, reporter_id, reported_user_id, reason)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE report_id = LAST_INSERT_ID(report_id), reason = VALUES(reason),
                                 status = \'open\', resolved_at = NULL, resolved_by = NULL'
    );
    $stmt->bind_param('iiis', $messageId, $reporterId, $reportedUserId, $reason);
    $stmt->execute();
    $reportId = (int)$conn->insert_id;
    $stmt->close();

    json_response(['success' => true, 'report_id' => $reportId, 'message_id' => $messageId]);
} catch (Throwable $e) {
    error_log('message report error: ' . $e->getMessage());
    json_response(['success' => false, 'error' => 'Server error'], 500);
}
