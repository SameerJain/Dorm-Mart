<?php

declare(strict_types=1);

// Include security utilities
require_once __DIR__ . '/../helpers/api_bootstrap.php';
require_once __DIR__ . '/../helpers/inventory.php';

require __DIR__ . '/../auth/auth_handle.php';
require __DIR__ . '/../database/db_connect.php';

init_json_endpoint('POST');

try {
    // Require authentication - this will redirect to login if not authenticated
    $userId = require_login();
    
    // DB connection
    $conn = db();
    $conn->set_charset('utf8mb4');

    // Check if scheduled_purchase_requests table exists
    $tableCheck = $conn->query("SHOW TABLES LIKE 'scheduled_purchase_requests'");
    $hasScheduledPurchaseTable = $tableCheck && $tableCheck->num_rows > 0;

    // Fetch seller listings from INVENTORY for current user
    // Include check for accepted scheduled purchases (if table exists)
    if ($hasScheduledPurchaseTable) {
        $sql = "SELECT 
                    i.product_id,
                    i.title,
                    i.listing_price,
                    i.item_status,
                    i.categories,
                    i.sold,
                    i.sold_to,
                    i.date_listed,
                    i.photos,
                    i.seller_id,
                    i.price_nego,
                    i.trades,
                    i.wishlisted,
                    i.item_location AS meet_location,
                    -- Ongoing purchases: Check if item has any accepted scheduled purchase requests
                    CASE 
                        WHEN EXISTS (
                            SELECT 1 FROM scheduled_purchase_requests spr 
                            WHERE spr.inventory_product_id = i.product_id 
                            AND spr.status = 'accepted'
                        ) THEN 1 
                        ELSE 0 
                    END AS has_accepted_scheduled_purchase
                FROM INVENTORY i
                WHERE i.seller_id = ?
                ORDER BY i.product_id DESC";
    } else {
        // Fallback query without scheduled_purchase_requests check
        $sql = "SELECT 
                    i.product_id,
                    i.title,
                    i.listing_price,
                    i.item_status,
                    i.categories,
                    i.sold,
                    i.sold_to,
                    i.date_listed,
                    i.photos,
                    i.seller_id,
                    i.price_nego,
                    i.trades,
                    i.wishlisted,
                    i.item_location AS meet_location,
                    0 AS has_accepted_scheduled_purchase,
                FROM INVENTORY i
                WHERE i.seller_id = ?
                ORDER BY i.product_id DESC";
    }

    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        $error = $conn->error;
        throw new RuntimeException('Failed to prepare query: ' . $error);
    }
    $stmt->bind_param('i', $userId);
    if (!$stmt->execute()) {
        $error = $stmt->error;
        throw new RuntimeException('Failed to execute query: ' . $error);
    }
    $res = $stmt->get_result();

    $data = [];
    while ($row = $res->fetch_assoc()) {
        $firstImage = inventory_first_photo($row['photos'] ?? null);

        $isSold = isset($row['sold']) ? (bool)$row['sold'] : false;
        $buyerId = $isSold ? ($row['sold_to'] ?? null) : null;
        $statusFromDb = isset($row['item_status']) && $row['item_status'] !== '' ? (string)$row['item_status'] : null;
        $status = $statusFromDb ?? ($isSold ? 'Sold' : 'Active');

        $catsArr = inventory_string_list($row['categories'] ?? null);

        $hasAcceptedScheduledPurchase = isset($row['has_accepted_scheduled_purchase']) && (int)$row['has_accepted_scheduled_purchase'] === 1;

        $priceNegotiable = isset($row['price_nego']) ? ((int)$row['price_nego'] === 1) : false;
        $acceptTrades = isset($row['trades']) ? ((int)$row['trades'] === 1) : false;
        $itemMeetLocation = isset($row['meet_location']) ? trim((string)$row['meet_location']) : null;
        $data[] = [
            'id' => (int)$row['product_id'],
            'title' => (string)$row['title'],
            'price' => isset($row['listing_price']) ? (float)$row['listing_price'] : 0.0,
            'status' => $status,
            'buyer_user_id' => $buyerId !== null ? (int)$buyerId : null,
            'seller_user_id' => (int)$row['seller_id'],
            'created_at' => $row['date_listed'],
            'image_url' => $firstImage,
            'categories' => $catsArr,
            'has_accepted_scheduled_purchase' => $hasAcceptedScheduledPurchase,
            'priceNegotiable' => $priceNegotiable,
            'acceptTrades' => $acceptTrades,
            'meet_location' => $itemMeetLocation,
            'wishlisted' => $row['wishlisted']
        ];
    }

    json_response(['success' => true, 'data' => $data]);
} catch (Throwable $e) {
    // Log error server-side (in production, use proper logging)
    error_log('Seller listings error: ' . $e->getMessage());
    error_log('Stack trace: ' . $e->getTraceAsString());

    json_response(['success' => false, 'error' => 'Server error'], 500);
}
