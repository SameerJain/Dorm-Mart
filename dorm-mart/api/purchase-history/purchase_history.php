<?php

declare(strict_types=1);

require_once __DIR__ . '/../security/security.php';
require_once __DIR__ . '/../auth/auth_handle.php';
require_once __DIR__ . '/../database/db_connect.php';

setSecurityHeaders();
setSecureCORS();

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method Not Allowed']);
    exit;
}

try {
    $userId = require_login();

    $payload = json_decode(file_get_contents('php://input'), true);
    if (!is_array($payload)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid JSON payload']);
        exit;
    }

    $year = isset($payload['year']) ? (int)$payload['year'] : 0;
    $currentYear = (int)date('Y');
    $minYear = 2016;
    $maxYear = $currentYear + 1;
    if ($year < $minYear || $year > $maxYear) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid or missing year']);
        exit;
    }

    $tz = new DateTimeZone('UTC');
    $rangeStart = DateTimeImmutable::createFromFormat('Y-m-d H:i:s', sprintf('%04d-01-01 00:00:00', $year), $tz);
    if (!$rangeStart) {
        throw new RuntimeException('Failed to construct date range');
    }
    $rangeEnd = $rangeStart->modify('+1 year');

    $conn = db();
    $conn->set_charset('utf8mb4');

    $historyItems = load_purchase_history_items($conn, $userId, $rangeStart, $rangeEnd);
    $legacyItems = load_legacy_purchased_items(
        $conn,
        $userId,
        $rangeStart->format('Y-m-d H:i:s'),
        $rangeEnd->format('Y-m-d H:i:s')
    );

    $rows = array_merge($historyItems, $legacyItems);

    usort(
        $rows,
        static function (array $a, array $b): int {
            $left = $a['transacted_at'] ?? '';
            $right = $b['transacted_at'] ?? '';
            if ($left === $right) {
                return 0;
            }
            return strcmp($right, $left);
        }
    );

    echo json_encode(['success' => true, 'data' => $rows]);
} catch (Throwable $e) {
    error_log('purchase_history.php error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Internal server error']);
}

/**
 * @return array<int, array<string, string|int>>
 */
function load_purchase_history_items(mysqli $conn, int $userId, DateTimeImmutable $start, DateTimeImmutable $end): array
{
    $stmt = $conn->prepare('SELECT items FROM purchase_history WHERE user_id = ? LIMIT 1');
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare purchase history lookup');
    }
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $res = $stmt->get_result();
    $row = $res ? $res->fetch_assoc() : null;
    $stmt->close();

    if (!$row || empty($row['items'])) {
        return [];
    }

    $decoded = json_decode((string)$row['items'], true);
    if (!is_array($decoded)) {
        return [];
    }

    $startTs = $start->getTimestamp();
    $endTs = $end->getTimestamp();

    $filtered = [];
    $productIds = [];
    foreach ($decoded as $entry) {
        if (!is_array($entry)) {
            continue;
        }
        $productId = isset($entry['product_id']) ? (int)$entry['product_id'] : 0;
        if ($productId <= 0) {
            continue;
        }
        $recordedAt = isset($entry['recorded_at']) ? (string)$entry['recorded_at'] : '';
        $recordedTs = strtotime($recordedAt);
        if ($recordedTs === false || $recordedTs < $startTs || $recordedTs >= $endTs) {
            continue;
        }

        $filtered[] = [
            'product_id' => $productId,
            'transacted_at' => gmdate('Y-m-d H:i:s', $recordedTs),
        ];
        $productIds[$productId] = $productId;
    }

    if (empty($filtered)) {
        return [];
    }

    $metadata = load_inventory_metadata($conn, array_values($productIds));
    $rows = [];
    foreach ($filtered as $entry) {
        $productId = $entry['product_id'];
        $meta = $metadata[$productId] ?? [];

        $title = $meta['title'] ?? ('Item #' . $productId);
        $sellerName = $meta['seller_name'] ?? 'Unknown seller';
        $imageUrl = $meta['image_url'] ?? '';

        $rows[] = [
            'item_id' => $productId,
            'title' => escapeHtml($title),
            'sold_by' => escapeHtml($sellerName),
            'transacted_at' => $entry['transacted_at'],
            'image_url' => $imageUrl,
        ];
    }

    return $rows;
}

/**
 * @return array<int, array<string, string>>
 */
function load_inventory_metadata(mysqli $conn, array $productIds): array
{
    if (empty($productIds)) {
        return [];
    }

    $placeholders = implode(',', array_fill(0, count($productIds), '?'));
    $sql = sprintf(
        'SELECT inv.product_id, inv.title, inv.photos, inv.seller_id, ua.first_name, ua.last_name
         FROM INVENTORY inv
         LEFT JOIN user_accounts ua ON ua.user_id = inv.seller_id
         WHERE inv.product_id IN (%s)',
        $placeholders
    );

    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare inventory metadata lookup');
    }

    $types = str_repeat('i', count($productIds));
    $params = [$types];
    foreach ($productIds as $idx => $value) {
        $productIds[$idx] = (int)$value;
        $params[] = &$productIds[$idx];
    }
    call_user_func_array([$stmt, 'bind_param'], $params);

    $stmt->execute();
    $res = $stmt->get_result();

    $map = [];
    while ($row = $res->fetch_assoc()) {
        $sellerFirst = $row['first_name'] ?? '';
        $sellerLast = $row['last_name'] ?? '';
        $sellerName = trim($sellerFirst . ' ' . $sellerLast);
        if ($sellerName === '') {
            $sellerId = isset($row['seller_id']) ? (int)$row['seller_id'] : 0;
            $sellerName = $sellerId > 0 ? 'Seller #' . $sellerId : 'Unknown seller';
        }

        $map[(int)$row['product_id']] = [
            'title' => $row['title'] ?? '',
            'seller_name' => $sellerName,
            'image_url' => resolve_primary_photo($row['photos'] ?? null),
        ];
    }

    $stmt->close();

    return $map;
}

/**
 * @return array<int, array<string, string|int>>
 */
function load_legacy_purchased_items(mysqli $conn, int $userId, string $start, string $end): array
{
    $sql = 'SELECT item_id, title, sold_by, transacted_at, image_url
            FROM purchased_items
            WHERE buyer_user_id = ? AND transacted_at >= ? AND transacted_at < ?
            ORDER BY transacted_at DESC';

    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare legacy purchase lookup');
    }

    $stmt->bind_param('iss', $userId, $start, $end);
    $stmt->execute();
    $res = $stmt->get_result();

    $rows = [];
    while ($row = $res->fetch_assoc()) {
        $rows[] = [
            'item_id' => (int)$row['item_id'],
            'title' => escapeHtml($row['title'] ?? ''),
            'sold_by' => escapeHtml($row['sold_by'] ?? ''),
            'transacted_at' => $row['transacted_at'] ?? '',
            'image_url' => $row['image_url'] ?? '',
        ];
    }

    $stmt->close();

    return $rows;
}

function resolve_primary_photo($photos): string
{
    if (is_string($photos) && trim($photos) !== '') {
        $decoded = json_decode($photos, true);
        if (json_last_error() === JSON_ERROR_NONE) {
            $photos = $decoded;
        }
    }

    if (is_array($photos)) {
        foreach ($photos as $photo) {
            if (is_string($photo) && trim($photo) !== '') {
                return $photo;
            }
        }
    } elseif (is_string($photos) && trim($photos) !== '') {
        return trim($photos);
    }

    return '';
}
