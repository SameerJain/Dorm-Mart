<?php
declare(strict_types=1);

require_once __DIR__ . '/../helpers/api_bootstrap.php';

init_json_endpoint('GET');

require_once __DIR__ . '/../auth/auth_handle.php';
require_once __DIR__ . '/../database/db_connect.php';
require_once __DIR__ . '/../helpers/notifications.php';
require_once __DIR__ . '/../helpers/request.php';

// Newest notifications returned per poll. Older ones stay in the database and
// still count toward unread_total; "Clear all" or deleting makes room.
const NOTIFICATION_LIST_LIMIT = 100;

try {
    $userId = require_login();

    $conn = db();
    $conn->set_charset('utf8mb4');

    // Stale-listing nudges have no scheduler, so they are generated here. The
    // page polls every few seconds; checking once an hour per session is plenty.
    if (request_is_same_origin_fetch()
        && time() - (int)($_SESSION['stale_listings_checked_at'] ?? 0) >= 3600) {
        $_SESSION['stale_listings_checked_at'] = time();
        notification_stale_listings($conn, $userId);
    }
    // Polled every few seconds; nothing below touches the session.
    session_write_close();

    // The badge needs the full unread count even though the list is capped.
    $countStmt = $conn->prepare(
        'SELECT COUNT(*) AS unread FROM notifications
          WHERE recipient_user_id = ? AND available_at <= NOW() AND is_read = 0'
    );
    if (!$countStmt) {
        throw new RuntimeException('Failed to prepare unread count');
    }
    $countStmt->bind_param('i', $userId);
    $countStmt->execute();
    $unreadTotal = (int)($countStmt->get_result()->fetch_assoc()['unread'] ?? 0);
    $countStmt->close();

    // Timestamps go out as ISO-8601 UTC ("...Z"); the raw DATETIME string was
    // read as local time by browsers and shown off by the user's UTC offset.
    // The INVENTORY join tells us when a listing link no longer leads anywhere.
    $stmt = $conn->prepare(
        'SELECT n.notification_id, n.type, n.title, n.message, n.image_url, n.severity,
                n.destination, n.is_read, n.product_id,
                DATE_FORMAT(n.created_at, "%Y-%m-%dT%H:%i:%sZ") AS created_at,
                i.product_id AS live_product_id
           FROM notifications n
           LEFT JOIN INVENTORY i ON i.product_id = n.product_id
          WHERE n.recipient_user_id = ? AND n.available_at <= NOW()
          ORDER BY n.created_at DESC, n.notification_id DESC
          LIMIT ?'
    );
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare query');
    }

    $limit = NOTIFICATION_LIST_LIMIT;
    $stmt->bind_param('ii', $userId, $limit);
    $stmt->execute();
    $res = $stmt->get_result();
    $notifications = [];
    while ($row = $res->fetch_assoc()) {
        $destination = $row['destination'];
        $unavailable = false;
        if (is_string($destination) && preg_match('#^/app/viewProduct/\d+#', $destination)
            && $row['live_product_id'] === null) {
            // The listing was deleted: send nowhere instead of to a dead page.
            $destination = null;
            $unavailable = true;
        }
        $notifications[] = [
            'notification_id' => (int)$row['notification_id'],
            'type' => $row['type'], 'title' => $row['title'], 'message' => $row['message'],
            'image_url' => $row['image_url'], 'severity' => $row['severity'],
            'destination' => $destination, 'is_read' => (bool)$row['is_read'],
            'listing_unavailable' => $unavailable,
            'created_at' => $row['created_at'],
        ];
    }
    $stmt->close();

    json_response([
        'success' => true,
        'notifications' => $notifications,
        'unread_total' => $unreadTotal,
        'limit' => NOTIFICATION_LIST_LIMIT,
    ]);
} catch (Throwable $e) {
    error_log('fetch_unread_notifications error: ' . $e->getMessage());
    json_response(['success' => false, 'error' => 'Internal server error'], 500);
}
