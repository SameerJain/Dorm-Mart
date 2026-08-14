<?php
declare(strict_types=1);

// dorm-mart/api/listings/landing_listings.php

// Include security utilities
require_once __DIR__ . '/../helpers/api_bootstrap.php';
require_once __DIR__ . '/../helpers/inventory.php';
require_once __DIR__ . '/../helpers/recommendations.php';

init_json_endpoint('GET', ['ok' => false, 'error' => 'Method Not Allowed']);

try {
    require __DIR__ . '/../auth/auth_handle.php';
    require __DIR__ . '/../database/db_connect.php';

    auth_boot_session();
    $userId = require_login();

    mysqli_report(MYSQLI_REPORT_OFF);
    $mysqli = db();

    $recommendationContext = recommendation_build_context($mysqli, $userId);

    $sql = "
        SELECT 
            i.product_id,
            i.title,
            i.categories,
            i.item_location,
            i.item_condition,
            i.photos,
            i.listing_price,
            i.trades,
            i.price_nego,
            i.date_listed,
            i.seller_id,
            i.sold,
            i.wishlisted,
            i.view_count,
            ua.first_name,
            ua.last_name,
            ua.email
        FROM INVENTORY AS i
        LEFT JOIN user_accounts AS ua ON i.seller_id = ua.user_id
        WHERE (i.sold = 0 OR i.sold IS NULL)
          AND i.item_status = 'Active'
          AND i.seller_id <> ?
        ORDER BY i.date_listed DESC, i.product_id DESC
        LIMIT 120
    ";

    $stmt = $mysqli->prepare($sql);
    if (!$stmt) {
        throw new Exception('SQL prepare failed: ' . $mysqli->error);
    }
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $res = $stmt->get_result();

    $rankedRows = [];
    while ($row = $res->fetch_assoc()) {
        $row['_recommendation'] = recommendation_score_listing($row, $recommendationContext);
        $rankedRows[] = $row;
    }
    $stmt->close();

    usort($rankedRows, static function (array $a, array $b): int {
        $scoreOrder = $b['_recommendation']['score'] <=> $a['_recommendation']['score'];
        if ($scoreOrder !== 0) {
            return $scoreOrder;
        }
        $dateOrder = strcmp((string)($b['date_listed'] ?? ''), (string)($a['date_listed'] ?? ''));
        return $dateOrder !== 0 ? $dateOrder : ((int)$b['product_id'] <=> (int)$a['product_id']);
    });

    $out = [];
    $now = time();

    foreach (array_slice($rankedRows, 0, 50) as $row) {
        $tags = inventory_string_list($row['categories'] ?? null);
        $image = inventory_first_photo($row['photos'] ?? null);

        // status from date_listed
        $status = 'AVAILABLE';
        $createdAt = null;
        if (!empty($row['date_listed'])) {
            $createdAt = $row['date_listed'] . ' 00:00:00';
            $ts = strtotime($row['date_listed']);
            if ($ts !== false) {
                $diffHrs = ($now - $ts) / 3600;
                if ($diffHrs < 48) {
                    $status = 'JUST POSTED';
                }
            }
        }

        $seller = inventory_display_name($row);
        $out[] = [
            'id'         => (int)$row['product_id'],
            'title'      => $row['title'] ?? 'Untitled',
            'price'      => $row['listing_price'] !== null ? (float)$row['listing_price'] : 0,
            'image'      => $image,      // <-- "/data/images/xxxx.png"
            'image_url'  => $image,
            'tags'       => $tags,
            'category'   => !empty($tags) ? $tags[0] : null,
            'location'   => $row['item_location'] ?? 'North Campus',
            'condition'  => $row['item_condition'] ?? '',
            'created_at' => $createdAt,
            'seller'     => $seller,
            'sold_by'    => $seller,
            'status'     => $status,
            'trades'     => (bool)$row['trades'],
            'price_nego' => (bool)$row['price_nego'],
            'recommendation_score' => (float)$row['_recommendation']['score'],
            'recommendation_reason' => $row['_recommendation']['reason'],
            'personalized' => (bool)$row['_recommendation']['personalized'],
        ];
    }

    json_response($out);

} catch (Throwable $e) {
    error_log('landing_listings error: ' . $e->getMessage());
    json_response(['ok' => false, 'error' => 'Server error'], 500);
}
