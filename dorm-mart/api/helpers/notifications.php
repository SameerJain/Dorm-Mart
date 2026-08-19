<?php
declare(strict_types=1);

require_once __DIR__ . '/inventory.php';

function notification_first_image(?string $photos): ?string
{
    return inventory_first_photo($photos);
}

function notification_insert(mysqli $conn, array $n): void
{
    $sql = 'INSERT IGNORE INTO notifications
      (recipient_user_id, type, product_id, scheduled_request_id, title, message,
       image_url, severity, destination, metadata, idempotency_key, available_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
    $stmt = $conn->prepare($sql);
    if (!$stmt) throw new RuntimeException('Failed to prepare notification');
    $recipient = (int)$n['recipient_user_id'];
    $product = isset($n['product_id']) ? (int)$n['product_id'] : null;
    $request = isset($n['scheduled_request_id']) ? (int)$n['scheduled_request_id'] : null;
    $type = (string)$n['type'];
    $title = (string)$n['title'];
    $message = (string)$n['message'];
    $image = $n['image_url'] ?? null;
    $severity = $n['severity'] ?? 'info';
    $destination = $n['destination'] ?? null;
    if ($destination !== null
        && (!is_string($destination) || !preg_match('#^/app(?:[/?]|$)#D', $destination))) {
        throw new InvalidArgumentException('Notification destination must be an internal app path');
    }
    $metadata = isset($n['metadata']) ? json_encode($n['metadata'], JSON_UNESCAPED_SLASHES) : null;
    $key = (string)$n['idempotency_key'];
    $available = $n['available_at'] ?? gmdate('Y-m-d H:i:s');
    $stmt->bind_param('isiissssssss', $recipient, $type, $product, $request, $title, $message, $image, $severity, $destination, $metadata, $key, $available);
    $stmt->execute();
    $stmt->close();
}

function notification_wishlist_users(mysqli $conn, int $productId, ?int $excludeUserId = null): array
{
    $sql = 'SELECT user_id FROM wishlist WHERE product_id = ?' . ($excludeUserId ? ' AND user_id != ?' : '');
    $stmt = $conn->prepare($sql);
    if (!$stmt) throw new RuntimeException('Failed to fetch wishlist recipients');
    if ($excludeUserId) $stmt->bind_param('ii', $productId, $excludeUserId);
    else $stmt->bind_param('i', $productId);
    $stmt->execute();
    $result = $stmt->get_result();
    $ids = [];
    while ($row = $result->fetch_assoc()) $ids[] = (int)$row['user_id'];
    $stmt->close();
    return $ids;
}

function notification_for_wishlist(mysqli $conn, int $productId, array $base, ?int $excludeUserId = null): void
{
    foreach (notification_wishlist_users($conn, $productId, $excludeUserId) as $recipient) {
        $n = $base;
        $n['recipient_user_id'] = $recipient;
        $n['product_id'] = array_key_exists('product_id', $base) ? $base['product_id'] : $productId;
        $n['idempotency_key'] = $base['idempotency_key'] . '-' . $recipient;
        notification_insert($conn, $n);
    }
}

function notification_cancel_schedule(mysqli $conn, int $requestId): void
{
    $stmt = $conn->prepare("DELETE FROM notifications WHERE scheduled_request_id = ? AND available_at > NOW()");
    if (!$stmt) throw new RuntimeException('Failed to cancel reminders');
    $stmt->bind_param('i', $requestId);
    $stmt->execute();
    $stmt->close();
}
