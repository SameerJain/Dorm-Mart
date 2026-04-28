<?php
declare(strict_types=1);

require_once __DIR__ . '/../helpers/api_bootstrap.php';
require_once __DIR__ . '/../helpers/inventory.php';

init_json_endpoint('GET');

require __DIR__ . '/../auth/auth_handle.php';
require __DIR__ . '/../database/db_connect.php';

function wishlist_seller_name(array $row): string
{
    return inventory_display_name($row);
}

try {
    $userId = require_login();
    
    $conn = db();
    $conn->set_charset('utf8mb4');

    $sql = "SELECT 
                w.wishlist_id,
                w.product_id,
                w.created_at,
                i.title,
                i.listing_price,
                i.item_status,
                i.categories,
                i.photos,
                i.seller_id,
                i.item_location,
                i.item_condition,
                i.description,
                i.trades,
                i.price_nego,
                i.date_listed,
                ua.first_name,
                ua.last_name,
                ua.email
            FROM wishlist w
            INNER JOIN INVENTORY i ON w.product_id = i.product_id
            LEFT JOIN user_accounts ua ON i.seller_id = ua.user_id
            WHERE w.user_id = ?
            ORDER BY w.created_at DESC";
    
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare query');
    }
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $result = $stmt->get_result();

    $items = [];
    while ($row = $result->fetch_assoc()) {
        $categories = inventory_string_list($row['categories'] ?? null);
        $photos = inventory_string_list($row['photos'] ?? null);

        $items[] = [
            'wishlist_id' => (int)$row['wishlist_id'],
            'product_id' => (int)$row['product_id'],
            'title' => (string)$row['title'],
            'price' => isset($row['listing_price']) ? (float)$row['listing_price'] : 0.0,
            'image_url' => $photos[0] ?? null,
            'categories' => $categories,
            'tags' => $categories, // For compatibility with ItemCardNew
            'seller' => wishlist_seller_name($row),
            'seller_id' => (int)$row['seller_id'],
            'item_location' => $row['item_location'] ?? '',
            'item_condition' => $row['item_condition'] ?? '',
            'status' => $row['item_status'] ?? 'Active',
            'created_at' => $row['created_at'],
            'date_listed' => $row['date_listed'],
        ];
    }
    $stmt->close();

    json_response(['success' => true, 'data' => $items]);
} catch (Throwable $e) {
    error_log('get_wishlist error: ' . $e->getMessage());
    json_response(['success' => false, 'error' => 'Internal server error'], 500);
}
