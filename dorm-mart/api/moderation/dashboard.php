<?php

declare(strict_types=1);

require_once __DIR__ . '/../helpers/api_bootstrap.php';
require_once __DIR__ . '/../auth/auth_handle.php';
require_once __DIR__ . '/../database/db_connect.php';

init_json_endpoint('GET');
require_moderator();

try {
    $conn = db();
    $conn->set_charset('utf8mb4');

    $statsResult = $conn->query(
        "SELECT
            (SELECT COUNT(*) FROM messages WHERE is_flagged = 1) AS flagged_messages,
            (SELECT COUNT(*) FROM message_reports WHERE status = 'open') AS open_reports,
            (SELECT COUNT(*) FROM message_reports) AS total_reports,
            (SELECT COUNT(*) FROM user_accounts WHERE is_banned = 1) AS banned_users"
    );
    $stats = $statsResult->fetch_assoc();

    $flaggedResult = $conn->query(
        "SELECT m.message_id, m.conv_id, m.sender_id, m.sender_fname, m.content,
                DATE_FORMAT(m.created_at, '%Y-%m-%dT%H:%i:%sZ') AS created_at,
                ua.email AS sender_email, ua.role AS sender_role,
                COALESCE(ua.is_banned, 0) AS sender_is_banned
           FROM messages m
           LEFT JOIN user_accounts ua ON ua.user_id = m.sender_id
          WHERE m.is_flagged = 1
          ORDER BY m.created_at DESC
          LIMIT 100"
    );
    $flaggedMessages = $flaggedResult->fetch_all(MYSQLI_ASSOC);

    $reportsResult = $conn->query(
        "SELECT r.report_id, r.message_id, r.reported_user_id, r.reason, r.status,
                DATE_FORMAT(r.created_at, '%Y-%m-%dT%H:%i:%sZ') AS created_at,
                m.conv_id, m.content,
                COALESCE(m.sender_fname, 'Deleted User') AS sender_name,
                CONCAT_WS(' ', reporter.first_name, reporter.last_name) AS reporter_name,
                reported.email AS reported_user_email, reported.role AS reported_user_role,
                COALESCE(reported.is_banned, 0) AS reported_user_is_banned
           FROM message_reports r
           JOIN messages m ON m.message_id = r.message_id
           LEFT JOIN user_accounts reporter ON reporter.user_id = r.reporter_id
           LEFT JOIN user_accounts reported ON reported.user_id = r.reported_user_id
          ORDER BY (r.status = 'open') DESC, r.created_at DESC
          LIMIT 100"
    );
    $reports = $reportsResult->fetch_all(MYSQLI_ASSOC);

    json_response([
        'success' => true,
        'stats' => [
            'flagged_messages' => (int)$stats['flagged_messages'],
            'open_reports' => (int)$stats['open_reports'],
            'total_reports' => (int)$stats['total_reports'],
            'banned_users' => (int)$stats['banned_users'],
        ],
        'flagged_messages' => $flaggedMessages,
        'reports' => $reports,
    ]);
} catch (Throwable $e) {
    error_log('moderation dashboard error: ' . $e->getMessage());
    json_response(['success' => false, 'error' => 'Server error'], 500);
}
