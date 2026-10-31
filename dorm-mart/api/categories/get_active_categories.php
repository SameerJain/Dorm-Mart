<?php
declare(strict_types=1);

require_once __DIR__ . '/../security/security.php';
require_once __DIR__ . '/../helpers/response.php';
require_once __DIR__ . '/../helpers/inventory.php';
init_security();

allow_options_request(200);

try {
    require_once __DIR__ . '/../database/db_connect.php';
    
    $conn = db();
    $conn->set_charset('utf8mb4');
    
    $sql = "
        SELECT DISTINCT categories 
        FROM INVENTORY 
        WHERE (sold = 0 OR sold IS NULL) 
        AND item_status = 'Active'
        AND categories IS NOT NULL
        AND categories != ''
        AND " . inventory_seller_visible_sql('seller_id') . "
    ";
    
    $result = $conn->query($sql);
    
    if ($result === false) {
        throw new RuntimeException('Query failed: ' . $conn->error);
    }
    
    $categoriesSet = [];
    
    while ($row = $result->fetch_assoc()) {
        $categoriesJson = $row['categories'];
        if ($categoriesJson) {
            $decoded = json_decode($categoriesJson, true);
            if (is_array($decoded)) {
                foreach ($decoded as $category) {
                    if (is_string($category) && trim($category) !== '') {
                        $categoriesSet[trim($category)] = true;
                    }
                }
            }
        }
    }
    
    $categories = array_keys($categoriesSet);
    sort($categories, SORT_STRING | SORT_FLAG_CASE);
    
    $escapedCategories = array_map('escape_html', $categories);
    
    $conn->close();
    
    json_response($escapedCategories);

} catch (Throwable $e) {
    error_log('get_active_categories error: ' . $e->getMessage());
    json_response(['ok' => false, 'error' => 'Server error'], 500);
}
