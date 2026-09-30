<?php
declare(strict_types=1);

function require_half_star_rating(array $payload, string $key, string $rangeError, string $stepError): float
{
    $rating = strict_decimal_value($payload[$key] ?? null);
    if ($rating === null || $rating < 0.5 || $rating > 5) {
        json_response(['success' => false, 'error' => $rangeError], 400);
    }
    if (abs(($rating * 2) - round($rating * 2)) > 0.000001) {
        json_response(['success' => false, 'error' => $stepError], 400);
    }
    return $rating;
}

function review_product(mysqli $conn, int $productId): ?array
{
    $stmt = $conn->prepare(
        'SELECT seller_id, sold, sold_to, item_status FROM INVENTORY WHERE product_id = ? LIMIT 1'
    );
    if (!$stmt) throw new RuntimeException('Failed to prepare product lookup');
    $stmt->bind_param('i', $productId);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    return $row ?: null;
}
