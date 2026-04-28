<?php

declare(strict_types=1);

require_once __DIR__ . '/../helpers/api_bootstrap.php';
require_once __DIR__ . '/../auth/auth_handle.php';
require_once __DIR__ . '/../database/db_connect.php';
require_once __DIR__ . '/../confirm_purchases/helpers.php';
require_once __DIR__ . '/../helpers/inventory.php';

init_json_endpoint('GET');

try {
    auth_boot_session();
    $userId = require_login();

    $productParam = trim((string)($_GET['product_id'] ?? $_GET['id'] ?? ''));
    $confirmParam = trim((string)($_GET['confirm_request_id'] ?? $_GET['confirm_id'] ?? ''));

    $productId = $productParam !== '' && ctype_digit($productParam) ? (int)$productParam : 0;
    $confirmRequestId = $confirmParam !== '' && ctype_digit($confirmParam) ? (int)$confirmParam : 0;

    if ($productId <= 0 && $confirmRequestId <= 0) {
        json_response(['success' => false, 'error' => 'product_id or confirm_request_id is required','product_id' => $productId, 'confirm_request_id' => $confirmRequestId], 400);
    }

    $conn = db();
    $conn->set_charset('utf8mb4');

    [$confirmRow, $resolvedProductId, $isAuthorized] = fetchConfirmRow($conn, $userId, $productId, $confirmRequestId);
    if (!$confirmRow) {
        json_response(['success' => false, 'error' => 'Receipt not found for this listing','product_id' => $productId, 'confirm_request_id' => $confirmRequestId], 404);
    }
    if (!$isAuthorized) {
        json_response(['success' => false, 'error' => 'You are not part of this transaction'], 403);
    }

    // Auto finalize if the request expired without a response.
    $confirmRow = auto_finalize_confirm_request($conn, $confirmRow) ?? $confirmRow;

    $scheduledRow = fetchScheduledRequest($conn, (int)$confirmRow['scheduled_request_id']);
    if (!$scheduledRow) {
        json_response(['success' => false, 'error' => 'Scheduled purchase details not found'], 500);
    }

    $productPayload = fetchProductPayload($conn, $resolvedProductId);
    if (!$productPayload) {
        json_response(['success' => false, 'error' => 'Product not found for this receipt'], 404);
    }

    $snapshot = get_confirm_snapshot($confirmRow);
    $finalPrice = resolve_confirm_final_price($conn, $confirmRow, $snapshot);
    if ($finalPrice === null && $confirmRow['final_price'] !== null) {
        $finalPrice = (float)$confirmRow['final_price'];
    }

    $receiptPayload = buildReceiptPayload($confirmRow, $scheduledRow, $snapshot, $finalPrice);

    json_response([
        'success' => true,
        'data' => [
            'product' => $productPayload,
            'receipt' => $receiptPayload,
        ],
    ], 200, JSON_UNESCAPED_SLASHES);
} catch (Throwable $e) {
    error_log('view_receipt error: ' . $e->getMessage());
    json_response(['success' => false, 'error' => 'Internal server error'], 500);
}

/**
 * Fetches the relevant confirm_purchase_requests row for the user.
 *
 * @return array{0: ?array, 1: int} Returns the row and resolved product id.
 */
function fetchConfirmRow(mysqli $conn, int $userId, int $productId, int $confirmId): array
{
    if ($confirmId > 0) {
        $sql = 'SELECT * FROM confirm_purchase_requests WHERE confirm_request_id = ?';
        $params = [$confirmId];
        $types = 'i';
        if ($productId > 0) {
            $sql .= ' AND inventory_product_id = ?';
            $params[] = $productId;
            $types .= 'i';
        }
        $sql .= ' LIMIT 1';
        $stmt = $conn->prepare($sql);
        if (!$stmt) {
            throw new RuntimeException('Failed to prepare confirm lookup');
        }
        $stmt->bind_param($types, ...$params);
    } else {
        if ($productId <= 0) {
            throw new InvalidArgumentException('product_id is required when confirm_request_id is not provided');
        }
        $stmt = $conn->prepare('SELECT * FROM confirm_purchase_requests WHERE inventory_product_id = ? ORDER BY confirm_request_id DESC LIMIT 1');
        if (!$stmt) {
            throw new RuntimeException('Failed to prepare confirm lookup');
        }
        $stmt->bind_param('i', $productId);
    }

    $stmt->execute();
    $res = $stmt->get_result();
    $row = $res ? $res->fetch_assoc() : null;
    $stmt->close();

    $resolvedProductId = $row ? (int)$row['inventory_product_id'] : $productId;
    $isAuthorized = false;
    if ($row) {
        $isAuthorized = ((int)$row['seller_user_id'] === $userId) || ((int)$row['buyer_user_id'] === $userId);
    }

    return [$row, $resolvedProductId, $isAuthorized];
}

function fetchScheduledRequest(mysqli $conn, int $requestId): ?array
{
    $sql = '
        SELECT spr.*,
               buyer.first_name AS buyer_first,
               buyer.last_name AS buyer_last,
               buyer.email AS buyer_email,
               seller.first_name AS seller_first,
               seller.last_name AS seller_last,
               seller.email AS seller_email
        FROM scheduled_purchase_requests spr
        LEFT JOIN user_accounts buyer ON buyer.user_id = spr.buyer_user_id
        LEFT JOIN user_accounts seller ON seller.user_id = spr.seller_user_id
        WHERE spr.request_id = ?
        LIMIT 1
    ';
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare scheduled lookup');
    }
    $stmt->bind_param('i', $requestId);
    $stmt->execute();
    $res = $stmt->get_result();
    $row = $res ? $res->fetch_assoc() : null;
    $stmt->close();
    return $row ?: null;
}

function fetchProductPayload(mysqli $conn, int $productId): ?array
{
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
            i.final_price,
            i.date_sold,
            i.sold_to,
            ua.first_name,
            ua.last_name,
            ua.email
        FROM INVENTORY AS i
        LEFT JOIN user_accounts AS ua ON i.seller_id = ua.user_id
        WHERE i.product_id = ?
        LIMIT 1
    ";

    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare product lookup');
    }
    $stmt->bind_param('i', $productId);
    $stmt->execute();
    $res = $stmt->get_result();
    $row = $res ? $res->fetch_assoc() : null;
    $stmt->close();

    if (!$row) {
        return null;
    }

    $fallback = isset($row['seller_id']) ? 'Seller #' . $row['seller_id'] : 'Unknown Seller';
    return inventory_product_payload($row, $fallback, false);
}

function buildReceiptPayload(array $confirmRow, array $scheduledRow, array $snapshot, ?float $finalPrice): array
{
    $meetingAt = $scheduledRow['meeting_at'] ?? ($snapshot['meeting_at'] ?? null);
    $meetLocation = $scheduledRow['meet_location']
        ?? ($snapshot['meet_location'] ?? ($snapshot['snapshot_meet_location'] ?? null));

    $purchaseDateIso = formatDateTimeValue(
        $confirmRow['buyer_response_at']
        ?? $confirmRow['auto_processed_at']
        ?? $confirmRow['updated_at']
        ?? $confirmRow['created_at']
        ?? $meetingAt
        ?? null
    );

    $sellerName = formatDisplayName($scheduledRow['seller_first'] ?? '', $scheduledRow['seller_last'] ?? '', 'Seller #' . $confirmRow['seller_user_id']);
    $buyerName = formatDisplayName($scheduledRow['buyer_first'] ?? '', $scheduledRow['buyer_last'] ?? '', 'Buyer #' . $confirmRow['buyer_user_id']);

    $negotiatedPrice = $scheduledRow['negotiated_price'] ?? ($snapshot['negotiated_price'] ?? null);
    $isTrade = isset($scheduledRow['is_trade']) ? (bool)$scheduledRow['is_trade'] : (isset($snapshot['is_trade']) ? (bool)$snapshot['is_trade'] : null);
    return [
        'receipt_id' => (int)$confirmRow['confirm_request_id'],
        'inventory_product_id' => (int)$confirmRow['inventory_product_id'],
        'status' => $confirmRow['status'] ?? '',
        'final_price' => $finalPrice,
        'seller_notes' => $confirmRow['seller_notes'] ?? '',
        'failure_reason' => $confirmRow['failure_reason'] ?? '',
        'failure_reason_notes' => $confirmRow['failure_reason_notes'] ?? '',
        'purchase_date' => $purchaseDateIso,
        'meet_location' => $meetLocation ?? '',
        'negotiated_price' => coerceFloat($negotiatedPrice),
        'trade_item_description' => $scheduledRow['trade_item_description'] ?? ($snapshot['trade_item_description'] ?? ''),
        'is_trade' => $isTrade,
        'comments' => $scheduledRow['description'] ?? '',
        'buyer_notes' => null,
        'buyer_user_id' => (int)$confirmRow['buyer_user_id'],
        'seller_user_id' => (int)$confirmRow['seller_user_id'],
        'buyer_name' => $buyerName,
        'seller_name' => $sellerName,
        'buyer_email' => $scheduledRow['buyer_email'] ?? '',
        'seller_email' => $scheduledRow['seller_email'] ?? '',
        'snapshot' => $snapshot,
    ];
}

function formatDateTimeValue($value): ?string
{
    if ($value === null || $value === '') {
        return null;
    }
    if ($value instanceof DateTimeInterface) {
        return $value->format(DateTime::ATOM);
    }
    if (is_numeric($value)) {
        $dt = new DateTime('@' . (int)$value);
        $dt->setTimezone(new DateTimeZone('UTC'));
        return $dt->format(DateTime::ATOM);
    }
    $dt = DateTime::createFromFormat('Y-m-d H:i:s', (string)$value, new DateTimeZone('UTC'));
    if (!$dt) {
        $dt = date_create((string)$value);
    }
    return $dt ? $dt->format(DateTime::ATOM) : null;
}

function coerceFloat($value): ?float
{
    if ($value === null || $value === '') {
        return null;
    }
    if (is_numeric($value)) {
        return (float)$value;
    }
    return null;
}

function formatDisplayName($first, $last, $fallback): string
{
    $first = trim((string)$first);
    $last = trim((string)$last);
    $name = trim($first . ' ' . $last);
    if ($name !== '') {
        return $name;
    }
    return $fallback;
}
