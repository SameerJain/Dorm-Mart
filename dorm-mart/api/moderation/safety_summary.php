<?php

declare(strict_types=1);

// Anonymous safety numbers for the public "Safety at Dorm Mart" page (the
// investor / transparency view). Counts and averages only: no names, emails,
// message text, listing titles, or ids leave this endpoint, so it needs no login.

require_once __DIR__ . '/../helpers/api_bootstrap.php';
require_once __DIR__ . '/../database/db_connect.php';
require_once __DIR__ . '/../helpers/listing_reports.php';

init_json_endpoint('GET');

// Resolution speed is measured over a recent window so old backlog doesn't skew it.
const SAFETY_SUMMARY_WINDOW_DAYS = 90;

try {
    $conn = db();
    $conn->set_charset('utf8mb4');

    $messageReports = $conn->query(
        "SELECT COUNT(*) AS total,
                SUM(status = 'open') AS open_count,
                SUM(status = 'resolved') AS resolved,
                SUM(status = 'dismissed') AS dismissed
           FROM message_reports"
    )->fetch_assoc();

    $listingReports = $conn->query(
        "SELECT COUNT(*) AS total,
                SUM(status = 'open') AS open_count,
                SUM(status = 'removed') AS removed,
                SUM(status = 'dismissed') AS dismissed
           FROM listing_reports"
    )->fetch_assoc();

    $window = SAFETY_SUMMARY_WINDOW_DAYS;
    $speed = $conn->query(
        "SELECT COUNT(*) AS handled,
                AVG(TIMESTAMPDIFF(MINUTE, created_at, resolved_at)) AS avg_minutes
           FROM (
                SELECT created_at, resolved_at FROM message_reports
                 WHERE resolved_at IS NOT NULL AND created_at >= UTC_TIMESTAMP() - INTERVAL {$window} DAY
                UNION ALL
                SELECT created_at, resolved_at FROM listing_reports
                 WHERE resolved_at IS NOT NULL AND created_at >= UTC_TIMESTAMP() - INTERVAL {$window} DAY
           ) handled_reports"
    )->fetch_assoc();

    $reasonRows = $conn->query(
        "SELECT reason, COUNT(*) AS report_count
           FROM listing_reports
          GROUP BY reason
          ORDER BY report_count DESC, reason
          LIMIT 3"
    )->fetch_all(MYSQLI_ASSOC);
    $topReasons = array_map(static fn(array $row): array => [
        'reason' => listing_report_reason_label((string)$row['reason']),
        'count' => (int)$row['report_count'],
    ], $reasonRows);

    $platform = $conn->query(
        "SELECT (SELECT COUNT(*) FROM user_accounts WHERE is_banned = 1) AS banned_accounts,
                (SELECT COUNT(*) FROM messages WHERE is_flagged = 1) AS flagged_messages"
    )->fetch_assoc();

    $avgMinutes = $speed['avg_minutes'] !== null ? (float)$speed['avg_minutes'] : null;

    header('Cache-Control: public, max-age=300');
    json_response([
        'success' => true,
        'data' => [
            'message_reports' => [
                'total' => (int)$messageReports['total'],
                'open' => (int)$messageReports['open_count'],
                'action_taken' => (int)$messageReports['resolved'],
                'dismissed' => (int)$messageReports['dismissed'],
            ],
            'listing_reports' => [
                'total' => (int)$listingReports['total'],
                'open' => (int)$listingReports['open_count'],
                'listings_removed' => (int)$listingReports['removed'],
                'dismissed' => (int)$listingReports['dismissed'],
                'top_reasons' => $topReasons,
            ],
            'response_time' => [
                'window_days' => SAFETY_SUMMARY_WINDOW_DAYS,
                'reports_handled' => (int)$speed['handled'],
                'avg_hours_to_decision' => $avgMinutes !== null ? round($avgMinutes / 60, 1) : null,
            ],
            'banned_accounts' => (int)$platform['banned_accounts'],
            'flagged_messages' => (int)$platform['flagged_messages'],
            'generated_at' => gmdate('Y-m-d\TH:i:s\Z'),
        ],
    ]);
} catch (Throwable $e) {
    error_log('safety summary error: ' . $e->getMessage());
    json_response(['success' => false, 'error' => 'Server error'], 500);
}
