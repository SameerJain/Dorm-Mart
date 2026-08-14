<?php
declare(strict_types=1);

require_once __DIR__ . '/inventory.php';

/**
 * Best-effort behavior tracking. A pending migration must never break a buyer action.
 */
function recommendation_record_behavior(
    mysqli $conn,
    int $userId,
    int $productId,
    string $event
): void {
    if ($userId <= 0 || $productId <= 0) {
        return;
    }

    if ($event === 'view') {
        $sql = 'INSERT INTO user_listing_behavior (user_id, product_id, view_count)
                VALUES (?, ?, 1)
                ON DUPLICATE KEY UPDATE
                  view_count = view_count + 1,
                  last_interacted_at = CURRENT_TIMESTAMP';
    } elseif ($event === 'wishlist_add' || $event === 'wishlist_remove') {
        $wishlisted = $event === 'wishlist_add' ? 1 : 0;
        $sql = 'INSERT INTO user_listing_behavior (user_id, product_id, is_wishlisted)
                VALUES (?, ?, ?)
                ON DUPLICATE KEY UPDATE
                  is_wishlisted = ?,
                  last_interacted_at = CURRENT_TIMESTAMP';
    } else {
        return;
    }

    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        error_log('recommendation behavior prepare failed: ' . $conn->error);
        return;
    }

    if ($event === 'view') {
        $stmt->bind_param('ii', $userId, $productId);
    } else {
        $stmt->bind_param('iiii', $userId, $productId, $wishlisted, $wishlisted);
    }

    if (!$stmt->execute()) {
        error_log('recommendation behavior update failed: ' . $stmt->error);
    }
    $stmt->close();
}

function recommendation_add_category(
    array &$profile,
    string $category,
    float $weight,
    string $source
): void {
    $label = trim($category);
    if ($label === '') {
        return;
    }

    $key = strtolower($label);
    if (!isset($profile[$key])) {
        $profile[$key] = ['label' => $label, 'weight' => 0.0, 'source' => $source];
    }
    $profile[$key]['weight'] += $weight;

    $sourcePriority = ['interest' => 1, 'view' => 2, 'wishlist' => 3, 'purchase' => 4];
    if (($sourcePriority[$source] ?? 0) > ($sourcePriority[$profile[$key]['source']] ?? 0)) {
        $profile[$key]['source'] = $source;
    }
}

/**
 * Builds category and exact-product signals for one buyer.
 *
 * @return array{categories: array, products: array, personalized: bool}
 */
function recommendation_build_context(mysqli $conn, int $userId): array
{
    $profile = [];
    $productSignals = [];

    $preferenceStmt = $conn->prepare(
        'SELECT interested_category_1, interested_category_2, interested_category_3
         FROM user_accounts WHERE user_id = ? LIMIT 1'
    );
    if ($preferenceStmt) {
        $preferenceStmt->bind_param('i', $userId);
        $preferenceStmt->execute();
        $row = $preferenceStmt->get_result()->fetch_assoc();
        $preferenceStmt->close();
        foreach ([
            $row['interested_category_1'] ?? '',
            $row['interested_category_2'] ?? '',
            $row['interested_category_3'] ?? '',
        ] as $category) {
            recommendation_add_category($profile, (string)$category, 3.0, 'interest');
        }
    }

    $behaviorStmt = $conn->prepare(
        'SELECT b.product_id, b.view_count, b.is_wishlisted, b.last_interacted_at, i.categories
         FROM user_listing_behavior b
         INNER JOIN INVENTORY i ON i.product_id = b.product_id
         WHERE b.user_id = ?'
    );
    if ($behaviorStmt) {
        $behaviorStmt->bind_param('i', $userId);
        $behaviorStmt->execute();
        $result = $behaviorStmt->get_result();
        while ($row = $result->fetch_assoc()) {
            $viewCount = min(5, max(0, (int)$row['view_count']));
            $isWishlisted = (bool)$row['is_wishlisted'];
            $ageDays = max(0.0, (time() - (strtotime((string)$row['last_interacted_at']) ?: time())) / 86400);
            $recency = max(0.25, 1.0 - ($ageDays / 120));
            $weight = (($viewCount * 0.75) + ($isWishlisted ? 5.0 : 0.0)) * $recency;
            $source = $isWishlisted ? 'wishlist' : 'view';

            foreach (inventory_string_list($row['categories'] ?? null) as $category) {
                recommendation_add_category($profile, $category, $weight, $source);
            }
            $productSignals[(int)$row['product_id']] = [
                'views' => $viewCount,
                'wishlisted' => $isWishlisted,
            ];
        }
        $behaviorStmt->close();
    }

    $purchaseStmt = $conn->prepare(
        'SELECT categories FROM INVENTORY WHERE sold_to = ? AND sold = 1'
    );
    if ($purchaseStmt) {
        $purchaseStmt->bind_param('i', $userId);
        $purchaseStmt->execute();
        $result = $purchaseStmt->get_result();
        while ($row = $result->fetch_assoc()) {
            foreach (inventory_string_list($row['categories'] ?? null) as $category) {
                recommendation_add_category($profile, $category, 8.0, 'purchase');
            }
        }
        $purchaseStmt->close();
    }

    return [
        'categories' => $profile,
        'products' => $productSignals,
        'personalized' => !empty($profile),
    ];
}

/**
 * @return array{score: float, personalized: bool, reason: string}
 */
function recommendation_score_listing(array $row, array $context): array
{
    $matched = [];
    foreach (inventory_string_list($row['categories'] ?? null) as $category) {
        $key = strtolower($category);
        if (isset($context['categories'][$key])) {
            $matched[] = $context['categories'][$key];
        }
    }

    usort($matched, static fn(array $a, array $b): int => $b['weight'] <=> $a['weight']);
    $affinity = 0.0;
    foreach ($matched as $index => $match) {
        $affinity += (float)$match['weight'] * ($index === 0 ? 1.0 : 0.2);
    }

    $productId = (int)($row['product_id'] ?? 0);
    $exact = $context['products'][$productId] ?? null;
    if ($exact) {
        $affinity += min(2.0, ((int)$exact['views']) * 0.35);
        if (!empty($exact['wishlisted'])) {
            $affinity += 4.0;
        }
    }

    $popularity = log(1 + max(0, (int)($row['wishlisted'] ?? 0))) * 0.8
        + log(1 + max(0, (int)($row['view_count'] ?? 0))) * 0.25;
    $listedAt = strtotime((string)($row['date_listed'] ?? '')) ?: 0;
    $ageDays = $listedAt > 0 ? max(0.0, (time() - $listedAt) / 86400) : 90.0;
    $freshness = max(0.0, 2.5 - ($ageDays / 14));

    if (!empty($exact['wishlisted'])) {
        $reason = 'In your wishlist';
    } elseif (!empty($matched)) {
        $reason = 'Based on your activity in ' . $matched[0]['label'];
    } elseif ($popularity >= $freshness) {
        $reason = 'Popular on campus';
    } else {
        $reason = 'Recently listed';
    }

    return [
        'score' => round($affinity + $popularity + $freshness, 4),
        'personalized' => $affinity > 0,
        'reason' => $reason,
    ];
}
