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

/**
 * Remove a "please respond" prompt once the request it asks about is settled
 * (answered, cancelled, expired or auto-accepted), so it cannot linger and
 * send someone to act on something that is already over.
 */
function notification_clear_prompt(mysqli $conn, int $requestId, string $type): void
{
    $stmt = $conn->prepare('DELETE FROM notifications WHERE scheduled_request_id = ? AND type = ?');
    if (!$stmt) throw new RuntimeException('Failed to clear notification prompt');
    $stmt->bind_param('is', $requestId, $type);
    $stmt->execute();
    $stmt->close();
}

/**
 * Tell someone they were just reviewed: a seller when a buyer reviews their
 * item, or a buyer when a seller rates them. Best-effort, because the review
 * itself is already saved and must not fail over a notification.
 *
 * @param string $kind 'product' (buyer reviewed the seller's item) or 'buyer'
 */
function notification_review_received(
    mysqli $conn,
    string $kind,
    int $recipientId,
    int $reviewerId,
    int $productId,
    float $rating,
    int $reviewId
): void {
    try {
        $stmt = $conn->prepare(
            'SELECT i.title, i.photos, u.first_name
               FROM INVENTORY i
               LEFT JOIN user_accounts u ON u.user_id = ?
              WHERE i.product_id = ? LIMIT 1'
        );
        if (!$stmt) throw new RuntimeException('Failed to prepare review notification lookup');
        $stmt->bind_param('ii', $reviewerId, $productId);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc() ?: [];
        $stmt->close();

        $title = (string)($row['title'] ?? 'Your item');
        $reviewer = trim((string)($row['first_name'] ?? '')) ?: 'Someone';
        $stars = rtrim(rtrim(number_format($rating, 1), '0'), '.');
        $isProduct = $kind === 'product';

        notification_insert($conn, [
            'recipient_user_id' => $recipientId,
            'type' => $isProduct ? 'review_received' : 'buyer_rating_received',
            'product_id' => $productId,
            'title' => $title,
            'message' => $isProduct
                ? "{$reviewer} left a {$stars}-star review of your item."
                : "{$reviewer} rated you {$stars} stars as a buyer.",
            'image_url' => notification_first_image($row['photos'] ?? null),
            'severity' => 'success',
            'destination' => $isProduct ? '/app/seller-dashboard' : '/app/setting/buyer-reviews',
            'metadata' => ['rating' => $rating, 'reviewer_user_id' => $reviewerId],
            'idempotency_key' => ($isProduct ? 'review-received-' : 'buyer-rating-received-') . $reviewId,
        ]);
    } catch (Throwable $e) {
        error_log('review notification failed: ' . $e->getMessage());
    }
}

/**
 * Nudge a seller once about an active listing that has had no activity for
 * 14 days since it was listed: nobody has saved it, messaged about it, or
 * sent a purchase request. Views alone don't count as activity.
 *
 * There is no scheduler for this; it runs lazily when the seller's
 * notifications load. The idempotency key per listing means the nudge is
 * sent at most once no matter how often it runs.
 */
function notification_stale_listings(mysqli $conn, int $sellerId): void
{
    try {
        $stmt = $conn->prepare(
            "SELECT i.product_id, i.title, i.photos, i.view_count
               FROM INVENTORY i
              WHERE i.seller_id = ?
                AND i.item_status = 'Active'
                AND (i.sold = 0 OR i.sold IS NULL)
                AND i.date_listed <= CURDATE() - INTERVAL 14 DAY
                AND NOT EXISTS (SELECT 1 FROM wishlist w WHERE w.product_id = i.product_id)
                AND NOT EXISTS (SELECT 1 FROM conversations c WHERE c.product_id = i.product_id)
                AND NOT EXISTS (
                    SELECT 1 FROM scheduled_purchase_requests s
                     WHERE s.inventory_product_id = i.product_id
                )"
        );
        if (!$stmt) throw new RuntimeException('Failed to prepare stale listing lookup');
        $stmt->bind_param('i', $sellerId);
        $stmt->execute();
        $rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
        $stmt->close();

        foreach ($rows as $row) {
            $productId = (int)$row['product_id'];
            $views = (int)$row['view_count'];

            notification_insert($conn, [
                'recipient_user_id' => $sellerId,
                'type' => 'listing_stale',
                'product_id' => $productId,
                'title' => (string)($row['title'] ?? 'Your listing'),
                'message' => sprintf(
                    'No saves, messages, or purchase requests in the 14 days since you listed this (%d %s). '
                        . 'A lower price or clearer photos can help it sell.',
                    $views,
                    $views === 1 ? 'view' : 'views'
                ),
                'image_url' => notification_first_image($row['photos'] ?? null),
                'severity' => 'info',
                'destination' => '/app/product-listing/edit/' . $productId,
                'metadata' => ['views' => $views],
                'idempotency_key' => "stale-listing-{$productId}",
            ]);
        }
    } catch (Throwable $e) {
        error_log('stale listing notification failed: ' . $e->getMessage());
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
