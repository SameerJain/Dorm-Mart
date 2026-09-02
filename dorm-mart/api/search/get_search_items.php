<?php
declare(strict_types=1);

// dorm-mart/api/search/get_search_items.php

require_once __DIR__ . '/../helpers/api_bootstrap.php';
require_once __DIR__ . '/../helpers/inventory.php';
require_once __DIR__ . '/../helpers/request.php';

init_json_endpoint('POST', ['ok' => false, 'error' => 'Method Not Allowed']);

try {
    require __DIR__ . '/../auth/auth_handle.php';
    require __DIR__ . '/../database/db_connect.php';

    auth_boot_session();
    $userId = require_login();

    // Parse JSON body or form data
    $contentLength = filter_var($_SERVER['CONTENT_LENGTH'] ?? null, FILTER_VALIDATE_INT);
    if ($contentLength !== false && $contentLength > MAX_JSON_REQUEST_BYTES) {
        json_response(['ok' => false, 'error' => 'Request body is too large'], 413);
    }
    $raw = file_get_contents('php://input', false, null, 0, MAX_JSON_REQUEST_BYTES + 1);
    if (is_string($raw) && strlen($raw) > MAX_JSON_REQUEST_BYTES) {
        json_response(['ok' => false, 'error' => 'Request body is too large'], 413);
    }
    $body = [];
    if ($raw !== false && strlen(trim((string)$raw)) > 0) {
        $decodedBody = decode_json_object($raw);
        if ($decodedBody === null) {
            json_response(['ok' => false, 'error' => 'Invalid JSON payload'], 400);
        }
        $body = $decodedBody;
    }
    if (empty($body)) {
        // Fallback to form-encoded
        $body = $_POST ?? [];
    }

    $queryValue = $body['q'] ?? ($body['search'] ?? '');
    $categoryValue = $body['category'] ?? '';
    if (!is_string($queryValue) || !is_string($categoryValue)) {
        json_response(['ok' => false, 'error' => 'Invalid search filters'], 400);
    }
    $qRaw = trim($queryValue);
    $category = trim($categoryValue);
    
    $q = $qRaw;
    if (mb_strlen($q) > 200) {
        json_response(['ok' => false, 'error' => 'Search query too long'], 400);
    }
    // Optional multiple categories support
    $categories = [];
    if (isset($body['categories'])) {
        if (is_array($body['categories'])) {
            foreach ($body['categories'] as $c) {
                if (!is_string($c)) {
                    json_response(['ok' => false, 'error' => 'Invalid category value'], 400);
                }
                $c = trim($c);
                if ($c !== '') $categories[] = $c;
            }
        } else {
            if (!is_string($body['categories'])) {
                json_response(['ok' => false, 'error' => 'Invalid category value'], 400);
            }
            $parts = explode(',', $body['categories']);
            foreach ($parts as $c) {
                $c = trim($c);
                if ($c !== '') $categories[] = $c;
            }
        }
    }
    $condition = is_string($body['condition'] ?? '') ? trim($body['condition'] ?? '') : null;
    $location = is_string($body['location'] ?? '') ? trim($body['location'] ?? '') : null;
    $ALLOWED_CONDITIONS = ['Like New', 'Excellent', 'Good', 'Fair', 'For Parts'];
    $ALLOWED_LOCATIONS  = ['North Campus', 'South Campus', 'Ellicott', 'Other'];
    $ALLOWED_CATEGORIES = json_decode(
        file_get_contents(__DIR__ . '/../categories/categories.json'), true
    ) ?? [];
    $categories = array_values(array_unique($categories));
    if (count($categories) > count($ALLOWED_CATEGORIES)
        || array_filter($categories, fn($c) => !in_array($c, $ALLOWED_CATEGORIES, true))) {
        json_response(['ok' => false, 'error' => 'Invalid category value'], 400);
    }
    if ($category !== '' && !in_array($category, $ALLOWED_CATEGORIES, true)) {
        json_response(['ok' => false, 'error' => 'Invalid category value'], 400);
    }
    if ($condition === null || ($condition !== '' && !in_array($condition, $ALLOWED_CONDITIONS, true))) {
        json_response(['ok' => false, 'error' => 'Invalid condition value'], 400);
    }
    if ($location === null || ($location !== '' && !in_array($location, $ALLOWED_LOCATIONS, true))) {
        json_response(['ok' => false, 'error' => 'Invalid location value'], 400);
    }
    $statusValue = $body['status'] ?? '';
    if (!is_string($statusValue)) {
        json_response(['ok' => false, 'error' => 'Invalid status value'], 400);
    }
    $status = strtoupper(trim($statusValue));
    $pricePattern = '/^(?:\d{1,4}(?:\.\d{1,2})?|\.\d{1,2})$/';
    if ((isset($body['minPrice']) && !is_string($body['minPrice']) && !is_int($body['minPrice']) && !is_float($body['minPrice']))
        || (isset($body['maxPrice']) && !is_string($body['maxPrice']) && !is_int($body['maxPrice']) && !is_float($body['maxPrice']))) {
        json_response(['ok' => false, 'error' => 'Invalid price filter'], 400);
    }
    $minPriceRaw = isset($body['minPrice']) ? trim((string)$body['minPrice']) : '';
    $maxPriceRaw = isset($body['maxPrice']) ? trim((string)$body['maxPrice']) : '';
    $minPrice = null;
    $maxPrice = null;
    if ($minPriceRaw !== '') {
        if (!preg_match($pricePattern, $minPriceRaw)) {
            json_response(['ok' => false, 'error' => 'Invalid minimum price'], 400);
        }
        $minPrice = (float)$minPriceRaw;
    }
    if ($maxPriceRaw !== '') {
        if (!preg_match($pricePattern, $maxPriceRaw)) {
            json_response(['ok' => false, 'error' => 'Invalid maximum price'], 400);
        }
        $maxPrice = (float)$maxPriceRaw;
    }
    if ($minPrice !== null && $minPrice < 0) {
        json_response(['ok' => false, 'error' => 'Minimum price cannot be negative'], 400);
    }
    if ($maxPrice !== null && $maxPrice > 9999.99) {
        json_response(['ok' => false, 'error' => 'Maximum price cannot exceed $9999.99'], 400);
    }
    if ($minPrice !== null && $maxPrice !== null && $minPrice > $maxPrice) {
        json_response(['ok' => false, 'error' => 'Minimum price cannot be greater than maximum price'], 400);
    }
    $sortValue = $body['sort'] ?? '';
    if (!is_string($sortValue)) {
        json_response(['ok' => false, 'error' => 'Invalid sort value'], 400);
    }
    $sort = strtolower(trim($sortValue));
    $ALLOWED_SORTS = ['', 'best', 'best_match', 'relevance', 'new', 'newest', 'old', 'oldest', 'price_asc', 'price_desc'];
    if (!in_array($sort, $ALLOWED_SORTS, true)) {
        json_response(['ok' => false, 'error' => 'Invalid sort value'], 400);
    }
    // Optional: include description in search when true
    $includeDesc = false;
    if (isset($body['includeDescription'])) {
        $includeDesc = strict_boolean_value($body['includeDescription']);
        if ($includeDesc === null) {
            json_response(['ok' => false, 'error' => 'Invalid description-search option'], 400);
        }
    } elseif (isset($body['scope'])) {
        if (!is_string($body['scope']) || !in_array(strtolower(trim($body['scope'])), ['title', 'all'], true)) {
            json_response(['ok' => false, 'error' => 'Invalid search scope'], 400);
        }
        $includeDesc = strtolower(trim($body['scope'])) !== 'title';
    }
    $limit = array_key_exists('limit', $body) ? strict_integer_value($body['limit']) : 50;
    if ($limit === null || $limit < 1 || $limit > 100) {
        json_response(['ok' => false, 'error' => 'Invalid result limit'], 400);
    }

    mysqli_report(MYSQLI_REPORT_OFF);
    $mysqli = db();

    // Base select (we may append a dynamic relevance column when searching)
    $selectCols = "
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
    ";

    $relevanceSql = '';
    $relevanceParams = [];
    $relevanceTypes = '';

    // If searching and sort is empty or explicitly set to best, prioritize similarity
    $useRelevance = ($q !== '') && in_array($sort, ['', 'best', 'best_match', 'relevance'], true);
    if ($useRelevance) {
        // Weighted matches: exact > prefix > contains (title), optional description contains
        $relevanceSql = ", ( ".
            " (CASE WHEN i.title = ? THEN 100 ELSE 0 END) +".
            " (CASE WHEN i.title LIKE ? THEN 50 ELSE 0 END) +".
            " (CASE WHEN i.title LIKE ? THEN 20 ELSE 0 END) ";
        $relevanceParams[] = $q;                 // exact
        $relevanceParams[] = $q . '%';           // prefix
        $relevanceParams[] = '%' . $q . '%';     // title contains
        $relevanceTypes   .= 'sss';
        if ($includeDesc) {
            $relevanceSql .= "+ (CASE WHEN i.description LIKE ? THEN 10 ELSE 0 END) ";
            $relevanceParams[] = '%' . $q . '%'; // desc contains
            $relevanceTypes   .= 's';
        }
        $relevanceSql .= ") AS relevance ";
    }

    $sql = "SELECT " . $selectCols . $relevanceSql . "\n" .
           "FROM INVENTORY AS i\n" .
           "LEFT JOIN user_accounts AS ua ON i.seller_id = ua.user_id\n";

    $where = [];
    $params = [];
    $types = '';

    // Enforce only Active and not sold
    $where[] = 'i.item_status = ?';
    $params[] = 'Active';
    $types   .= 's';
    $where[] = '(i.sold IS NULL OR i.sold = 0)';

    // Category is stored as JSON array (column: categories)
    if ($category !== '') {
        // Match a single category
        $where[] = 'JSON_CONTAINS(i.categories, ?, "$")';
        $params[] = json_encode($category, JSON_UNESCAPED_UNICODE);
        $types   .= 's';
    } elseif (!empty($categories)) {
        // Match any of the provided categories
        $parts = [];
        foreach ($categories as $cat) {
            $parts[] = 'JSON_CONTAINS(i.categories, ?, "$")';
            $params[] = json_encode($cat, JSON_UNESCAPED_UNICODE);
            $types   .= 's';
        }
        if (!empty($parts)) {
            $where[] = '(' . implode(' OR ', $parts) . ')';
        }
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

    // Optional toggles
    $priceNegoIn = null;
    $hasPriceNego = isset($body['priceNego']) || isset($body['priceNegotiable']);
    $priceNego = isset($body['priceNego']) ? strict_boolean_value($body['priceNego']) : null;
    $priceNegotiable = isset($body['priceNegotiable']) ? strict_boolean_value($body['priceNegotiable']) : null;
    if ((isset($body['priceNego']) && $priceNego === null)
        || (isset($body['priceNegotiable']) && $priceNegotiable === null)) {
        json_response(['ok' => false, 'error' => 'Invalid negotiable-price option'], 400);
    }
    if ($priceNego !== null && $priceNegotiable !== null && $priceNego !== $priceNegotiable) {
        json_response(['ok' => false, 'error' => 'Conflicting negotiable-price options'], 400);
    }
    $priceNegoIn = $priceNego ?? $priceNegotiable;
    if ($hasPriceNego && $priceNegoIn === null) {
        json_response(['ok' => false, 'error' => 'Invalid negotiable-price option'], 400);
    }
    if ($priceNegoIn !== null) {
        if ($priceNegoIn) {
            $where[] = 'i.price_nego = 1';
        }
    }
    if (isset($body['trades'])) {
        $tradesBool = strict_boolean_value($body['trades']);
        if ($tradesBool === null) {
            json_response(['ok' => false, 'error' => 'Invalid trades option'], 400);
        }
        if ($tradesBool) {
            $where[] = 'i.trades = 1';
        }
    }

    // Search query across title (and optionally description)
    if ($q !== '') {
        if ($includeDesc) {
            $where[] = '(i.title LIKE ? OR i.description LIKE ?)';
            $params[] = '%' . $q . '%';
            $params[] = '%' . $q . '%';
            $types   .= 'ss';
        } else {
            $where[] = 'i.title LIKE ?';
            $params[] = '%' . $q . '%';
            $types   .= 's';
        }
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
    if ($useRelevance) {
        $order = ' ORDER BY relevance DESC, i.date_listed DESC, i.product_id DESC ';
    } elseif ($sort === 'new' || $sort === 'newest') {
        $order = ' ORDER BY i.date_listed DESC, i.product_id DESC ';
    } elseif ($sort === 'old' || $sort === 'oldest') {
        $order = ' ORDER BY i.date_listed ASC, i.product_id ASC ';
    } elseif ($sort === 'price_asc') {
        $order = ' ORDER BY i.listing_price ASC, i.product_id DESC ';
    } elseif ($sort === 'price_desc') {
        $order = ' ORDER BY i.listing_price DESC, i.product_id DESC ';
    }
    $sql .= $order . "\n" . ' LIMIT ? ';

    // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
    $stmt = $mysqli->prepare($sql);
    if ($stmt === false) {
        throw new Exception('Prepare failed: ' . $mysqli->error);
    }

    // Bind params: where params, then relevance params (if any), then limit
    // All parameters are safely bound, preventing SQL injection
    $typesWithLimit = $relevanceTypes . $types . 'i';
    $paramsWithLimit = array_merge($relevanceParams, $params);
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
        $tags = inventory_string_list($row['categories'] ?? null);
        $image = inventory_first_photo($row['photos'] ?? null);

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

        $seller = inventory_display_name($row);
        $out[] = [
            'id'         => (int)$row['product_id'],
            'title'      => $row['title'] ?? 'Untitled',
            'price'      => $row['listing_price'] !== null ? (float)$row['listing_price'] : 0,
            'image'      => $image,
            'image_url'  => $image,
            'tags'       => $tags,
            'category'   => !empty($tags) ? $tags[0] : null,
            'location'   => $row['item_location'] ?? '',
            'condition'  => $row['item_condition'] ?? '',
            'created_at' => $createdAt,
            'seller'     => $seller,
            'sold_by'    => $seller,
            'status'     => $statusOut,
            'trades'     => (bool)$row['trades'],
            'price_nego' => (bool)$row['price_nego'],
        ];
    }

    json_response($out);

} catch (Throwable $e) {
    error_log('get_search_items error: ' . $e->getMessage());
    json_response(['ok' => false, 'error' => 'Server error'], 500);
}
