<?php
declare(strict_types=1);

require_once __DIR__ . '/../chat/helpers.php';
require_once __DIR__ . '/../helpers/notifications.php';

function scheduled_purchase_has_active_accepted(mysqli $conn, int $productId, int $excludeRequestId): bool
{
    $stmt = $conn->prepare('
        SELECT COUNT(*) as cnt
        FROM scheduled_purchase_requests spr
        WHERE spr.inventory_product_id = ?
          AND spr.status = \'accepted\'
          AND spr.request_id != ?
          AND COALESCE((
            SELECT CASE
              WHEN cpr.status IN (\'buyer_accepted\', \'auto_accepted\') AND cpr.is_successful = 0 THEN 0
              ELSE 1
            END
            FROM confirm_purchase_requests cpr
            WHERE cpr.scheduled_request_id = spr.request_id
            ORDER BY cpr.confirm_request_id DESC
            LIMIT 1
          ), 1) = 1
    ');
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare active accepted check');
    }

    $stmt->bind_param('ii', $productId, $excludeRequestId);
    $stmt->execute();
    $res = $stmt->get_result();
    $row = $res ? $res->fetch_assoc() : null;
    $stmt->close();

    return $row && (int)$row['cnt'] > 0;
}

/**
 * Whether the listing has a schedule still in play: one awaiting the buyer's
 * answer, or an accepted one whose latest confirmation has not ended it.
 */
function scheduled_purchase_has_open_request(mysqli $conn, int $productId): bool
{
    $stmt = $conn->prepare("
        SELECT COUNT(*) as cnt
        FROM scheduled_purchase_requests spr
        WHERE spr.inventory_product_id = ?
          AND (
            spr.status = 'pending'
            OR (
              spr.status = 'accepted'
              AND COALESCE((
                SELECT CASE
                  WHEN cpr.status IN ('buyer_accepted', 'auto_accepted') AND cpr.is_successful = 0 THEN 0
                  ELSE 1
                END
                FROM confirm_purchase_requests cpr
                WHERE cpr.scheduled_request_id = spr.request_id
                ORDER BY cpr.confirm_request_id DESC
                LIMIT 1
              ), 1) = 1
            )
          )
    ");
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare open request check');
    }
    $stmt->bind_param('i', $productId);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    return $row && (int)$row['cnt'] > 0;
}

/** Status of the newest Confirm Purchase form sent for a schedule, or null if none. */
function scheduled_purchase_latest_confirm_status(mysqli $conn, int $requestId): ?string
{
    $stmt = $conn->prepare(
        'SELECT status FROM confirm_purchase_requests
          WHERE scheduled_request_id = ?
          ORDER BY confirm_request_id DESC
          LIMIT 1'
    );
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare confirm status lookup');
    }
    $stmt->bind_param('i', $requestId);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    return $row ? (string)$row['status'] : null;
}

function scheduled_purchase_now_utc_atom(): string
{
    return (new DateTime('now', new DateTimeZone('UTC')))->format(DateTime::ATOM);
}

function scheduled_purchase_user_display_name(mysqli $conn, int $userId): string
{
    $names = chat_display_names($conn, [$userId]);
    return $names[$userId] ?? ('User ' . $userId);
}

function scheduled_purchase_conversation_participants(mysqli $conn, int $conversationId): ?array
{
    $stmt = $conn->prepare('SELECT user1_id, user2_id FROM conversations WHERE conv_id = ? LIMIT 1');
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare conversation lookup');
    }

    $stmt->bind_param('i', $conversationId);
    $stmt->execute();
    $res = $stmt->get_result();
    $row = $res ? $res->fetch_assoc() : null;
    $stmt->close();

    return $row ?: null;
}

/**
 * Cancel every schedule still in play for a user who is leaving the
 * marketplace (account deleted or banned): pending requests and accepted ones
 * whose sale has not completed. Pending Confirm Purchase forms are voided, the
 * other party is told, and items this user had reserved go back on sale.
 *
 * Runs inside the caller's transaction. A Stripe payment that still succeeds
 * later is refunded by the webhook, which treats a cancelled schedule as inactive.
 *
 * @return int number of schedules cancelled
 */
function scheduled_purchase_cancel_all_for_user(mysqli $conn, int $userId, string $counterpartMessage): int
{
    $stmt = $conn->prepare(
        "SELECT spr.request_id, spr.status, spr.seller_user_id, spr.buyer_user_id,
                spr.inventory_product_id, inv.title, inv.photos
           FROM scheduled_purchase_requests spr
           LEFT JOIN INVENTORY inv ON inv.product_id = spr.inventory_product_id
          WHERE (spr.seller_user_id = ? OR spr.buyer_user_id = ?)
            AND spr.status IN ('pending', 'accepted')
          FOR UPDATE"
    );
    if (!$stmt) throw new RuntimeException('Failed to prepare open schedule lookup');
    $stmt->bind_param('ii', $userId, $userId);
    $stmt->execute();
    $schedules = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();

    $cancel = $conn->prepare(
        "UPDATE scheduled_purchase_requests SET status = 'cancelled', canceled_by_user_id = NULL
          WHERE request_id = ? AND status IN ('pending', 'accepted')"
    );
    $void = $conn->prepare(
        "UPDATE confirm_purchase_requests SET status = 'seller_cancelled'
          WHERE scheduled_request_id = ? AND status = 'pending'"
    );
    $release = $conn->prepare(
        "UPDATE INVENTORY SET item_status = 'Active' WHERE product_id = ? AND item_status = 'Pending'"
    );
    if (!$cancel || !$void || !$release) throw new RuntimeException('Failed to prepare schedule cancellation');

    $cancelled = 0;
    foreach ($schedules as $schedule) {
        $requestId = (int)$schedule['request_id'];
        // A completed sale stays completed; only unfinished schedules are cancelled.
        if (in_array(scheduled_purchase_latest_confirm_status($conn, $requestId),
                ['buyer_accepted', 'auto_accepted', 'payment_completed'], true)) {
            continue;
        }

        $cancel->bind_param('i', $requestId);
        $cancel->execute();
        if ($cancel->affected_rows !== 1) continue;
        $cancelled++;
        $void->bind_param('i', $requestId);
        $void->execute();
        notification_cancel_schedule($conn, $requestId);
        notification_clear_prompt($conn, $requestId, 'schedule_request');
        notification_clear_prompt($conn, $requestId, 'confirm_request');

        $productId = (int)($schedule['inventory_product_id'] ?? 0);
        $title = (string)($schedule['title'] ?? 'Scheduled purchase');
        $image = notification_first_image($schedule['photos'] ?? null);
        $counterpartId = (int)$schedule['seller_user_id'] === $userId
            ? (int)$schedule['buyer_user_id']
            : (int)$schedule['seller_user_id'];
        if ($counterpartId > 0) {
            notification_insert($conn, [
                'recipient_user_id' => $counterpartId, 'type' => 'schedule_cancelled',
                'product_id' => $productId > 0 ? $productId : null, 'scheduled_request_id' => $requestId,
                'title' => $title, 'message' => $counterpartMessage, 'image_url' => $image,
                'severity' => 'urgent', 'destination' => '/app/seller-dashboard/ongoing-purchases',
                'idempotency_key' => 'schedule-cancelled-' . $requestId,
            ]);
        }

        if ($schedule['status'] !== 'accepted' || $productId <= 0
            || scheduled_purchase_has_active_accepted($conn, $productId, $requestId)) {
            continue;
        }
        $release->bind_param('i', $productId);
        $release->execute();
        if ($release->affected_rows > 0) {
            notification_for_wishlist($conn, $productId, [
                'type' => 'item_back_on_sale', 'title' => $title, 'message' => $title . ' is back on sale.',
                'image_url' => $image, 'severity' => 'success', 'destination' => '/app/viewProduct/' . $productId,
                'idempotency_key' => 'back-on-sale-cancel-' . $requestId,
            ], $userId);
        }
    }
    $cancel->close();
    $void->close();
    $release->close();

    return $cancelled;
}
