<?php
declare(strict_types=1);

// dorm-mart/api/search/getSearchItems.php

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Method Not Allowed']);
    exit;
}

try {
    require __DIR__ . '/../auth/auth_handle.php';
    require __DIR__ . '/../database/db_connect.php';

    auth_boot_session();
    $userId = require_login();

    // Parse JSON body or form data
    $raw = file_get_contents('php://input');
    $body = [];
    if ($raw !== false && strlen(trim((string)$raw)) > 0) {
        $tmp = json_decode($raw, true);
        if (json_last_error() === JSON_ERROR_NONE && is_array($tmp)) {
            $body = $tmp;
        }
    }
    if (empty($body)) {
        // Fallback to form-encoded
        $body = $_POST ?? [];
    }

    $q         = isset($body['q']) ? trim((string)$body['q']) : (isset($body['search']) ? trim((string)$body['search']) : '');
    $category  = isset($body['category']) ? trim((string)$body['category']) : '';
    $condition = isset($body['condition']) ? trim((string)$body['condition']) : '';
    $location  = isset($body['location']) ? trim((string)$body['location']) : '';
    $status    = isset($body['status']) ? strtoupper(trim((string)$body['status'])) : '';
    $minPrice  = isset($body['minPrice']) ? (float)$body['minPrice'] : null;
    $maxPrice  = isset($body['maxPrice']) ? (float)$body['maxPrice'] : null;
    $sort      = isset($body['sort']) ? strtolower(trim((string)$body['sort'])) : '';
    $limit     = isset($body['limit']) ? max(1, min(100, (int)$body['limit'])) : 50;

    mysqli_report(MYSQLI_REPORT_OFF);
    $mysqli = db();

    // Base select
    $sql = "
        SELECT 
            i.product_id,
            i.title,
            i.categories,
            i.item_location,
            i.item_condition,
            i.description,
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
    ";

    $where = [];
    $params = [];
    $types = '';

    // Status filter: AVAILABLE (sold = 0 or NULL), SOLD (sold = 1)
    if ($status === 'AVAILABLE') {
        $where[] = '(i.sold = 0 OR i.sold IS NULL)';
    } elseif ($status === 'SOLD') {
        $where[] = '(i.sold = 1)';
    }

    // Category is stored as JSON array (column: categories)
    if ($category !== '') {
        // Use JSON_CONTAINS to match a string inside the root array
        $where[] = 'JSON_CONTAINS(i.categories, ?, "$")';
        $params[] = json_encode($category, JSON_UNESCAPED_UNICODE);
        $types   .= 's';
    }

    // Condition and location (exact matches)
    if ($condition !== '') {
        $where[] = 'i.item_condition = ?';
        $params[] = $condition;
        $types   .= 's';
    }
    if ($location !== '') {
        $where[] = 'i.item_location = ?';
        $params[] = $location;
        $types   .= 's';
    }

    // Search query across title and description
    if ($q !== '') {
        $where[] = '(i.title LIKE ? OR i.description LIKE ?)';
        $like = '%' . $mysqli->real_escape_string($q) . '%';
        $params[] = $like;
        $params[] = $like;
        $types   .= 'ss';
    }

    // Price range
    if ($minPrice !== null) {
        $where[] = 'i.listing_price >= ?';
        $params[] = $minPrice;
        $types   .= 'd';
    }
    if ($maxPrice !== null) {
        $where[] = 'i.listing_price <= ?';
        $params[] = $maxPrice;
        $types   .= 'd';
    }

    if (!empty($where)) {
        $sql .= ' WHERE ' . implode(' AND ', $where) . "\n";
    }

    // Sorting
    $order = ' ORDER BY i.date_listed DESC, i.product_id DESC ';
    if ($sort === 'new' || $sort === 'newest') {
        $order = ' ORDER BY i.date_listed DESC, i.product_id DESC ';
    } elseif ($sort === 'price_asc') {
        $order = ' ORDER BY i.listing_price ASC, i.product_id DESC ';
    } elseif ($sort === 'price_desc') {
        $order = ' ORDER BY i.listing_price DESC, i.product_id DESC ';
    }
    $sql .= $order . "\n" . ' LIMIT ? ';

    // Prepare statement
    $stmt = $mysqli->prepare($sql);
    if ($stmt === false) {
        throw new Exception('Prepare failed: ' . $mysqli->error);
    }

    // Bind params (plus limit at the end)
    $typesWithLimit = $types . 'i';
    $paramsWithLimit = $params;
    $paramsWithLimit[] = $limit;

    if ($typesWithLimit !== '') {
        $stmt->bind_param($typesWithLimit, ...$paramsWithLimit);
    }

    if (!$stmt->execute()) {
        throw new Exception('Execute failed: ' . $stmt->error);
    }

    $res = $stmt->get_result();
    $out = [];
    $now = time();
    while ($row = $res->fetch_assoc()) {
        // categories JSON -> array
        $tags = [];
        if (!empty($row['categories'])) {
            $decoded = json_decode($row['categories'], true);
            if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
                $tags = array_values(array_filter($decoded, fn($v) => is_string($v) && $v !== ''));
            }
        }

        // photos JSON -> first photo path
        $image = null;
        if (!empty($row['photos'])) {
            $photos = json_decode($row['photos'], true);
            if (json_last_error() === JSON_ERROR_NONE && is_array($photos) && count($photos)) {
                $first = $photos[0];
                if (is_string($first)) {
                    $image = $first;
                } elseif (is_array($first) && isset($first['url'])) {
                    $image = $first['url'];
                }
            }
        }

        // status from date_listed
        $statusOut = 'AVAILABLE';
        $createdAt = null;
        if (!empty($row['date_listed'])) {
            $createdAt = $row['date_listed'] . ' 00:00:00';
            $ts = strtotime($row['date_listed']);
            if ($ts !== false) {
                $diffHrs = ($now - $ts) / 3600;
                if ($diffHrs < 48) {
                    $statusOut = 'JUST POSTED';
                }
            }
        }
        if ((int)($row['sold'] ?? 0) === 1) {
            $statusOut = 'SOLD';
        }

        // seller name
        $seller = 'Unknown Seller';
        $first = trim((string)($row['first_name'] ?? ''));
        $last  = trim((string)($row['last_name'] ?? ''));
        if ($first !== '' || $last !== '') {
            $seller = trim($first . ' ' . $last);
        } elseif (!empty($row['email'])) {
            $seller = $row['email'];
        }

        $out[] = [
            'id'         => (int)$row['product_id'],
            'title'      => $row['title'] ?? 'Untitled',
            'price'      => $row['listing_price'] !== null ? (float)$row['listing_price'] : 0,
            'image'      => $image,
            'image_url'  => $image,
            'tags'       => $tags,
            'category'   => !empty($tags) ? $tags[0] : null,
            'location'   => $row['item_location'] ?? null,
            'condition'  => $row['item_condition'] ?? null,
            'created_at' => $createdAt,
            'seller'     => $seller,
            'sold_by'    => $seller,
            'status'     => $statusOut,
            'trades'     => (bool)$row['trades'],
            'price_nego' => (bool)$row['price_nego'],
        ];
    }

    echo json_encode($out);
    exit;

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'ok' => false,
        'error' => 'Server error',
        'detail' => $e->getMessage(),
    ]);
    exit;
}

