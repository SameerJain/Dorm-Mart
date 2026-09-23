<?php
declare(strict_types=1);

/** Max simultaneous Active listings per seller (every create/activate path checks this). */
const MAX_ACTIVE_LISTINGS_PER_SELLER = 25;

/**
 * Count the seller's Active listings while holding a lock on their account row.
 *
 * Must run inside a transaction. Two concurrent creates/activations would
 * otherwise both read a count of 24 and both insert, overshooting the cap; the
 * row lock makes the second one wait until the first commits and then count it.
 */
function listing_cap_locked_active_count(mysqli $conn, int $sellerId, int $excludeProductId = 0): int
{
    $lock = $conn->prepare('SELECT user_id FROM user_accounts WHERE user_id = ? FOR UPDATE');
    $lock->bind_param('i', $sellerId);
    $lock->execute();
    $lock->store_result();
    $lock->close();

    $stmt = $conn->prepare(
        "SELECT COUNT(*) AS cnt FROM INVENTORY WHERE seller_id = ? AND item_status = 'Active' AND product_id != ?"
    );
    $stmt->bind_param('ii', $sellerId, $excludeProductId);
    $stmt->execute();
    $count = (int)$stmt->get_result()->fetch_assoc()['cnt'];
    $stmt->close();
    return $count;
}
