<?php
declare(strict_types=1);

require_once __DIR__ . '/../helpers/api_bootstrap.php';

init_json_endpoint('GET');

require __DIR__ . '/../auth/auth_handle.php';
require __DIR__ . '/../database/db_connect.php';

try {
    $userId = require_login();

    $conn = db();
    $conn->set_charset('utf8mb4');

    $stmt = $conn->prepare(
        'SELECT notification_id, type, title, message, image_url, severity, destination, is_read, created_at
         FROM notifications WHERE recipient_user_id = ? AND available_at <= NOW()
         ORDER BY created_at DESC, notification_id DESC'
    );
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare query');
    }

    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $res = $stmt->get_result();
    $notifications = [];
    $unreadTotal = 0;
    while ($row = $res->fetch_assoc()) {
        $isRead = (bool)$row['is_read'];
        if (!$isRead) $unreadTotal++;
        $notifications[] = [
            'notification_id' => (int)$row['notification_id'],
            'type' => $row['type'], 'title' => $row['title'], 'message' => $row['message'],
            'image_url' => $row['image_url'], 'severity' => $row['severity'],
            'destination' => $row['destination'], 'is_read' => $isRead,
            'created_at' => $row['created_at'],
        ];
    }
    $stmt->close();

    json_response(['success' => true, 'notifications' => $notifications, 'unread_total' => $unreadTotal]);
} catch (Throwable $e) {
    error_log('fetch_unread_notifications error: ' . $e->getMessage());
    json_response(['success' => false, 'error' => 'Internal server error'], 500);
}
