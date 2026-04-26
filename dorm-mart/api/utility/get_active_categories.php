<?php
declare(strict_types=1);

require_once __DIR__ . '/../security/security.php';
initSecurity();

header('Content-Type: application/json; charset=utf-8');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

try {
    require_once __DIR__ . '/../database/db_connect.php';
    
    $conn = db();
    $conn->set_charset('utf8mb4');
    
    // Query to get all categories from active, unsold items
    $sql = "
        SELECT DISTINCT categories 
        FROM INVENTORY 
        WHERE (sold = 0 OR sold IS NULL) 
        AND item_status = 'Active'
        AND categories IS NOT NULL
        AND categories != ''
    ";
    
    $result = $conn->query($sql);
    
    if ($result === false) {
        throw new RuntimeException('Query failed: ' . $conn->error);
    }
    
    // Aggregate all unique categories
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
    
    // Convert to array and sort alphabetically
    $categories = array_keys($categoriesSet);
    sort($categories, SORT_STRING | SORT_FLAG_CASE);
    
    // XSS PROTECTION: Escape user-generated content before returning in JSON
    $escapedCategories = array_map('escapeHtml', $categories);
    
    $conn->close();
    
    // Return the array of active categories
    echo json_encode($escapedCategories);

} catch (Throwable $e) {
    error_log('get_active_categories error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Server error']);
}

