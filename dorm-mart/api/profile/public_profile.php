<?php
declare(strict_types=1);

require_once __DIR__ . '/../auth/auth_handle.php';
require_once __DIR__ . '/../database/db_connect.php';
require_once __DIR__ . '/../helpers/api_bootstrap.php';
require_once __DIR__ . '/../helpers/inventory.php';
require_once __DIR__ . '/profile_helpers.php';

init_json_endpoint('GET');

try {
    auth_boot_session();

    if (!is_string($_GET['username'] ?? null)) {
        json_response(['success' => false, 'error' => 'Invalid username'], 400);
    }
    $usernameParam = trim($_GET['username']);
    if ($usernameParam === '') {
        json_response(['success' => false, 'error' => 'Username is required'], 400);
    }
    if (strlen($usernameParam) > 64) {
        json_response(['success' => false, 'error' => 'Invalid username'], 400);
    }

    $normalizedUsername = strtolower($usernameParam);

    $conn = db();
    $conn->set_charset('utf8mb4');

    $userRow = fetch_public_profile_row($conn, $normalizedUsername);
    if (!$userRow) {
        json_response(['success' => false, 'error' => 'Profile not found'], 404);
    }

    $userId = (int)$userRow['user_id'];
    $ratingStats = fetch_rating_stats($conn, $userId);
    $listings = fetch_active_listings($conn, $userId);
    $reviews  = fetch_reviews($conn, $userId);

    $fullName = trim(trim((string)$userRow['first_name']) . ' ' . trim((string)$userRow['last_name']));
    $email    = (string)($userRow['email'] ?? '');
    $username = inventory_username_from_email($email);

    $response = [
        'success' => true,
        'profile' => [
            'user_id'     => $userId,
            'name'        => $fullName !== '' ? $fullName : null,
            'username'    => $username,
            'image_url'   => format_profile_media_url($userRow['profile_photo'] ?? null),
            'bio'         => $userRow['bio'] ?? '',
            'instagram'   => $userRow['instagram'] ?? '',
            'avg_rating'  => $ratingStats['avg_rating'],
            'review_count'=> $ratingStats['review_count'],
        ],
        'listings' => $listings,
        'reviews'  => $reviews,
    ];

    $conn->close();

    json_response($response);
} catch (Throwable $e) {
    error_log('public_profile.php error: ' . $e->getMessage());
    json_response(['success' => false, 'error' => 'Internal server error'], 500);
}

function fetch_public_profile_row(mysqli $conn, string $username): ?array
{
    $sql = 'SELECT user_id, first_name, last_name, email, profile_photo, bio, instagram
            FROM user_accounts
            WHERE LOWER(SUBSTRING_INDEX(email, "@", 1)) = ?
              AND is_banned = 0
            LIMIT 1';
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare username lookup');
    }
    $stmt->bind_param('s', $username);
    $stmt->execute();
    $result = $stmt->get_result();
    $row = $result ? $result->fetch_assoc() : null;
    $stmt->close();
    return $row ?: null;
}

function fetch_active_listings(mysqli $conn, int $userId): array
{
    $sql = 'SELECT product_id, title, listing_price, item_status, photos, date_listed
            FROM INVENTORY
            WHERE seller_id = ? AND item_status = \'Active\' AND (sold IS NULL OR sold = 0)
            ORDER BY date_listed DESC, product_id DESC
            LIMIT 30';
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare listings lookup');
    }
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $result = $stmt->get_result();

    $listings = [];
    while ($row = $result->fetch_assoc()) {
        $photoUrl = inventory_first_photo($row['photos'] ?? null);
        $listings[] = [
            'product_id' => (int)$row['product_id'],
            'title'      => $row['title'] ?? 'Untitled',
            'price'      => isset($row['listing_price']) ? (float)$row['listing_price'] : 0.0,
            'status'     => $row['item_status'] ?? 'AVAILABLE',
            'image_url'  => $photoUrl ? format_profile_media_url($photoUrl) : null,
            'date_listed'=> $row['date_listed'] ?? null,
        ];
    }

    $stmt->close();
    return $listings;
}

