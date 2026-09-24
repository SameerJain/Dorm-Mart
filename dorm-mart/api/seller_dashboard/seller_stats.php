<?php

declare(strict_types=1);

// Seller dashboard insights that the listing rows alone cannot show: money made,
// reputation, meetups on the calendar, and how fast items sell.

require_once __DIR__ . '/../helpers/api_bootstrap.php';
require_once __DIR__ . '/listing_cap.php';

require __DIR__ . '/../auth/auth_handle.php';
require __DIR__ . '/../database/db_connect.php';

init_json_endpoint('GET');

function seller_stats_row(mysqli $conn, string $sql, string $types, ...$params): array
{
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare seller stats query');
    }
    $stmt->bind_param($types, ...$params);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc() ?: [];
    $stmt->close();
    return $row;
}

try {
    $userId = require_login();

    $conn = db();
    $conn->set_charset('utf8mb4');

    // Completed sales: the confirmed final price when there is one, otherwise the asking price.
    $sales = seller_stats_row(
        $conn,
        "SELECT COUNT(*) AS sales_count,
                COALESCE(SUM(COALESCE(final_price, listing_price)), 0) AS earnings,
                AVG(CASE WHEN date_sold IS NOT NULL AND date_listed IS NOT NULL
                         THEN GREATEST(DATEDIFF(date_sold, date_listed), 0) END) AS avg_days_to_sell
           FROM INVENTORY
          WHERE seller_id = ? AND (sold = 1 OR item_status = 'Sold')",
        'i',
        $userId
    );

    $reviews = seller_stats_row(
        $conn,
        'SELECT COUNT(*) AS review_count, AVG(rating) AS rating_avg
           FROM product_reviews WHERE seller_user_id = ?',
        'i',
        $userId
    );

    $meetups = seller_stats_row(
        $conn,
        "SELECT SUM(status = 'accepted' AND meeting_at >= UTC_TIMESTAMP()) AS upcoming,
                MIN(CASE WHEN status = 'accepted' AND meeting_at >= UTC_TIMESTAMP() THEN meeting_at END) AS next_meeting_at,
                SUM(status = 'pending' AND meeting_at >= UTC_TIMESTAMP()) AS awaiting_reply
           FROM scheduled_purchase_requests
          WHERE seller_user_id = ?",
        'i',
        $userId
    );

    $salesCount = (int)($sales['sales_count'] ?? 0);
    $earnings = round((float)($sales['earnings'] ?? 0), 2);
    $nextMeeting = $meetups['next_meeting_at'] ?? null;

    json_response([
        'success' => true,
        'data' => [
            'sales_count' => $salesCount,
            'earnings' => $earnings,
            'avg_sale' => $salesCount > 0 ? round($earnings / $salesCount, 2) : null,
            'avg_days_to_sell' => $sales['avg_days_to_sell'] !== null ? round((float)$sales['avg_days_to_sell'], 1) : null,
            'review_count' => (int)($reviews['review_count'] ?? 0),
            'rating_avg' => $reviews['rating_avg'] !== null ? round((float)$reviews['rating_avg'], 1) : null,
            'upcoming_meetups' => (int)($meetups['upcoming'] ?? 0),
            'next_meeting_at' => $nextMeeting !== null
                ? (new DateTimeImmutable((string)$nextMeeting, new DateTimeZone('UTC')))->format(DateTime::ATOM)
                : null,
            'awaiting_reply' => (int)($meetups['awaiting_reply'] ?? 0),
            'active_limit' => MAX_ACTIVE_LISTINGS_PER_SELLER,
        ],
    ]);
} catch (Throwable $e) {
    error_log('seller_stats error: ' . $e->getMessage());
    json_response(['success' => false, 'error' => 'Server error'], 500);
}
