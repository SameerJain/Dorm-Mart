<?php
declare(strict_types=1);

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
