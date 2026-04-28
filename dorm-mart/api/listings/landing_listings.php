<?php
declare(strict_types=1);

// dorm-mart/api/listings/landing_listings.php

// Include security utilities
require_once __DIR__ . '/../helpers/api_bootstrap.php';
require_once __DIR__ . '/../helpers/inventory.php';

init_json_endpoint('GET', ['ok' => false, 'error' => 'Method Not Allowed']);

try {
    require __DIR__ . '/../auth/auth_handle.php';
    require __DIR__ . '/../database/db_connect.php';

    auth_boot_session();
    $userId = require_login();

    mysqli_report(MYSQLI_REPORT_OFF);
    $mysqli = db();

    // ============================================================================
    // SQL INJECTION PROTECTION: Safe Query (No User Input)
    // ============================================================================
    // This query contains no user input - it uses only hardcoded values (0, NULL, 40).
    // There are no WHERE clause parameters from user input, so SQL injection is not possible.
    // If this query were to accept user input (e.g., filtering by search terms), we would
    // need to use prepared statements with parameter binding.
    // ============================================================================
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
            ua.first_name,
            ua.last_name,
            ua.email
        FROM INVENTORY AS i
        LEFT JOIN user_accounts AS ua ON i.seller_id = ua.user_id
        WHERE (i.sold = 0 OR i.sold IS NULL)
          AND i.item_status = 'Active'
        ORDER BY i.date_listed DESC, i.product_id DESC
        LIMIT 40
    ";

    $res = $mysqli->query($sql);
    if ($res === false) {
        throw new Exception("SQL error: " . $mysqli->error);
    }

    $out = [];
    $now = time();

    while ($row = $res->fetch_assoc()) {
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
            'rating'     => 4.7,
            'status'     => $status,
            'trades'     => (bool)$row['trades'],
            'price_nego' => (bool)$row['price_nego'],
        ];
    }

    json_response($out);

} catch (Throwable $e) {
    error_log('landing_listings error: ' . $e->getMessage());
    json_response(['ok' => false, 'error' => 'Server error'], 500);
}
