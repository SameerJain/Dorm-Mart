<?php
declare(strict_types=1);

require_once __DIR__ . '/../helpers/inventory.php';

if (!function_exists('format_profile_media_url')) {
    function format_profile_media_url($value): ?string
    {
        if (!is_string($value)) {
            return null;
        }
        $trimmed = trim($value);
        if ($trimmed === '') {
            return null;
        }

        if (preg_match('#^https?://#i', $trimmed) || strpos($trimmed, 'data:') === 0) {
            return $trimmed;
        }

        if (strpos($trimmed, '/api/media/image.php') === 0) {
            return $trimmed;
        }

        if ($trimmed[0] !== '/') {
            $trimmed = '/' . ltrim($trimmed, '/');
        }

        return build_profile_image_proxy_url($trimmed);
    }
}

if (!function_exists('build_profile_image_proxy_url')) {
    function build_profile_image_proxy_url(string $source): string
    {
        $apiBase = rtrim(get_profile_api_base_path(), '/');
        if ($apiBase === '') {
            $apiBase = '/api';
        }
        return $apiBase . '/media/image.php?url=' . rawurlencode($source);
    }
}

if (!function_exists('get_profile_api_base_path')) {
    function get_profile_api_base_path(): string
    {
        $scriptName = $_SERVER['SCRIPT_NAME'] ?? '';
        if ($scriptName === '') {
            return '/api';
        }
        $profileDir = dirname($scriptName);
        $apiBase = dirname($profileDir);
        if ($apiBase === '.' || $apiBase === DIRECTORY_SEPARATOR) {
            return '/api';
        }
        return $apiBase;
    }
}

if (!function_exists('fetch_rating_stats')) {
    /**
     * @return array{avg_rating: float, review_count: int}
     */
    function fetch_rating_stats(mysqli $conn, int $userId): array
    {
        $sql = 'SELECT COALESCE(AVG(rating), 0) AS avg_rating, COUNT(*) AS review_count
                FROM product_reviews WHERE seller_user_id = ?';

        $stmt = $conn->prepare($sql);
        if (!$stmt) {
            throw new RuntimeException('Failed to prepare rating stats lookup');
        }
        $stmt->bind_param('i', $userId);
        $stmt->execute();
        $result = $stmt->get_result();
        $row = $result ? $result->fetch_assoc() : null;
        $stmt->close();

        return [
            'avg_rating'   => isset($row['avg_rating']) ? round((float)$row['avg_rating'], 2) : 0.0,
            'review_count' => isset($row['review_count']) ? (int)$row['review_count'] : 0,
        ];
    }
}

if (!function_exists('fetch_reviews')) {
    /**
     * Shared by my_profile (with the buyer's email, which its UI shows) and
     * public_profile (without it: a public page must not leak buyer emails).
     *
     * @return array<int, array<string, mixed>>
     */
    function fetch_reviews(mysqli $conn, int $userId, bool $includeBuyerEmail = false): array
    {
        $sql = <<<SQL
SELECT 
    pr.review_id,
    pr.product_id,
    pr.buyer_user_id,
    pr.rating,
    pr.review_text,
    pr.image1_url,
    pr.image2_url,
    pr.image3_url,
    pr.created_at,
    inv.title AS product_title,
    buyer.first_name AS buyer_first,
    buyer.last_name AS buyer_last,
    buyer.email AS buyer_email
FROM product_reviews pr
LEFT JOIN INVENTORY inv ON pr.product_id = inv.product_id
LEFT JOIN user_accounts buyer ON pr.buyer_user_id = buyer.user_id
WHERE pr.seller_user_id = ?
ORDER BY pr.created_at DESC
SQL;

        $stmt = $conn->prepare($sql);
        if (!$stmt) {
            throw new RuntimeException('Failed to prepare reviews lookup');
        }
        $stmt->bind_param('i', $userId);
        $stmt->execute();
        $result = $stmt->get_result();

        $reviews = [];
        while ($row = $result->fetch_assoc()) {
            $buyerName = trim(trim((string)$row['buyer_first']) . ' ' . trim((string)$row['buyer_last']));
            if ($buyerName === '') {
                $buyerName = inventory_username_from_email((string)($row['buyer_email'] ?? '')) ?: 'Buyer #' . (int)$row['buyer_user_id'];
            }
            $review = [
                'review_id'      => (int)$row['review_id'],
                'product_id'     => (int)$row['product_id'],
                'reviewer_name'  => $buyerName,
            ];
            if ($includeBuyerEmail) {
                $review['reviewer_email'] = $row['buyer_email'] ?? '';
            }
            $review += [
                'reviewer_username' => inventory_username_from_email((string)($row['buyer_email'] ?? '')),
                'product_title'  => $row['product_title'] ?? 'Untitled product',
                'review'         => $row['review_text'] ?? '',
                'image_1'        => format_profile_media_url($row['image1_url'] ?? null),
                'image_2'        => format_profile_media_url($row['image2_url'] ?? null),
                'image_3'        => format_profile_media_url($row['image3_url'] ?? null),
                'rating'         => (float)$row['rating'],
                'created_at'     => $row['created_at'],
            ];
            $reviews[] = $review;
        }

        $stmt->close();
        return $reviews;
    }
}
