<?php
declare(strict_types=1);

/**
 * GET /api/profile/my_profile.php
 * Returns the authenticated user's profile details along with seller review metadata.
 */

require_once __DIR__ . '/../auth/auth_handle.php';
require_once __DIR__ . '/../database/db_connect.php';
require_once __DIR__ . '/../helpers/api_bootstrap.php';
require_once __DIR__ . '/profile_helpers.php';

init_json_endpoint('GET');

try {
    $userId = require_login();
    $conn = db();
    $conn->set_charset('utf8mb4');

    $profileRow = fetch_profile_row($conn, $userId);
    if (!$profileRow) {
        json_response(['success' => false, 'error' => 'Profile not found'], 404);
    }

    $ratingStats = fetch_rating_stats($conn, $userId);
    $reviews     = fetch_reviews($conn, $userId, true);

    $fullName = trim(trim((string)$profileRow['first_name']) . ' ' . trim((string)$profileRow['last_name']));
    $email    = (string)($profileRow['email'] ?? '');
    $username = inventory_username_from_email($email);

    $response = [
        'success'     => true,
        'profile'     => [
            'name'        => $fullName !== '' ? $fullName : null,
            'username'    => $username,
            'email'       => $email,
            'image_url'   => format_profile_media_url($profileRow['profile_photo'] ?? null),
            'bio'         => $profileRow['bio'] ?? '',
            'instagram'   => $profileRow['instagram'] ?? '',
            'avg_rating'  => $ratingStats['avg_rating'],
            'review_count'=> $ratingStats['review_count'],
        ],
        'reviews'     => $reviews,
    ];

    $conn->close();
    json_response($response);
} catch (Throwable $e) {
    error_log('my_profile.php error: ' . $e->getMessage());
    json_response(['success' => false, 'error' => 'Internal server error'], 500);
}

/**
 * @return array<string, mixed>|null
 */
function fetch_profile_row(mysqli $conn, int $userId): ?array
{
    $sql = 'SELECT first_name, last_name, email, profile_photo, bio, instagram 
            FROM user_accounts WHERE user_id = ? LIMIT 1';

    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare profile lookup');
    }
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $result = $stmt->get_result();
    $row = $result ? $result->fetch_assoc() : null;
    $stmt->close();

    return $row ?: null;
}

