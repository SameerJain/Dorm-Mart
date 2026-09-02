<?php
declare(strict_types=1);

/**
 * POST /api/profile/update_profile.php
 * Persists editable profile fields such as bio, instagram URL, and profile photo reference.
 */

require_once __DIR__ . '/../auth/auth_handle.php';
require_once __DIR__ . '/../database/db_connect.php';
require_once __DIR__ . '/../helpers/api_bootstrap.php';
require_once __DIR__ . '/../helpers/request.php';
require_once __DIR__ . '/../helpers/image_upload.php';
require_once __DIR__ . '/profile_helpers.php';

init_json_endpoint('POST');

try {
    $userId = require_login();
    $data = json_request_body_or_error();
    require_csrf_token($data['csrf_token'] ?? null);

    $setClauses = [];
    $types      = '';
    $params     = [];

    if (array_key_exists('bio', $data)) {
        $bio = sanitize_bio_value($data['bio']);
        if ($bio === null) {
            $setClauses[] = 'bio = NULL';
        } else {
            $setClauses[] = 'bio = ?';
            $types       .= 's';
            $params[]     = $bio;
        }
    }

    if (array_key_exists('instagram', $data)) {
        $instagram = sanitize_link_value($data['instagram']);
        if ($instagram === null) {
            $setClauses[] = 'instagram = NULL';
        } else {
            $setClauses[] = 'instagram = ?';
            $types       .= 's';
            $params[]     = $instagram;
        }
    }

    $photoKey = null;
    foreach (['profile_photo', 'profile_photo_url', 'image_url'] as $candidate) {
        if (array_key_exists($candidate, $data)) {
            $photoKey = $candidate;
            break;
        }
    }
    if ($photoKey !== null) {
        $photoPath = sanitize_profile_photo_value($data[$photoKey], $userId);
        if ($photoPath === null) {
            $setClauses[] = 'profile_photo = NULL';
        } else {
            $setClauses[] = 'profile_photo = ?';
            $types       .= 's';
            $params[]     = $photoPath;
        }
    }

    if (empty($setClauses)) {
        json_response(['success' => false, 'error' => 'No updatable fields were provided'], 400);
    }

    $conn = db();
    $conn->set_charset('utf8mb4');

    $sql = 'UPDATE user_accounts SET ' . implode(', ', $setClauses) . ' WHERE user_id = ? LIMIT 1';
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare profile update');
    }

    $types   .= 'i';
    $params[] = $userId;

    $bindValues = [$types];
    foreach ($params as $key => $value) {
        $params[$key] = $value;
        $bindValues[] = &$params[$key];
    }
    call_user_func_array([$stmt, 'bind_param'], $bindValues);

    $stmt->execute();
    $stmt->close();

    $updatedProfile = fetch_updated_fields($conn, $userId);
    $conn->close();

    json_response([
        'success' => true,
        'profile' => $updatedProfile,
    ]);
} catch (Throwable $e) {
    error_log('update_profile.php error: ' . $e->getMessage());
    json_response(['success' => false, 'error' => 'Internal server error'], 500);
}

function sanitize_bio_value($value): ?string
{
    if ($value === null) {
        return null;
    }
    if (!is_string($value)) {
        json_response(['success' => false, 'error' => 'Invalid bio'], 400);
    }
    $bio = trim($value);
    if ($bio === '') {
        return null;
    }
    if (mb_strlen($bio) > 200) {
        json_response(['success' => false, 'error' => 'Bio is too long'], 400);
    }
    return $bio;
}

function sanitize_link_value($value): ?string
{
    if ($value === null) {
        return null;
    }
    if (!is_string($value)) {
        json_response(['success' => false, 'error' => 'Invalid Instagram URL'], 400);
    }
    $link = trim($value);
    if ($link === '') {
        return null;
    }
    if (mb_strlen($link) > 150) {
        json_response(['success' => false, 'error' => 'Link is too long'], 400);
    }
    if (!preg_match('#^https?://(www\.)?instagram\.com/[a-zA-Z0-9._]{1,30}/?$#i', $link)) {
        json_response(['success' => false, 'error' => 'Invalid Instagram URL'], 400);
    }
    return $link;
}

function sanitize_profile_photo_value($value, int $userId): ?string
{
    if ($value === null) {
        return null;
    }
    if (!is_string($value)) {
        json_response(['success' => false, 'error' => 'Invalid profile photo path'], 400);
    }
    $url = trim($value);
    if ($url === '') {
        return null;
    }
    if (strlen($url) > 255) {
        json_response(['success' => false, 'error' => 'Profile photo URL is too long'], 400);
    }
    $pattern = '#^/images/profile_' . $userId . '_[a-f0-9]{16}\.(?:jpg|png|webp)$#D';
    if (!preg_match($pattern, $url)) {
        json_response(['success' => false, 'error' => 'Profile photo must reference your uploaded image'], 400);
    }
    $root = real_upload_path(data_images_dir());
    $path = $root !== null ? realpath($root . DIRECTORY_SEPARATOR . basename($url)) : false;
    $prefix = $root !== null ? rtrim($root, '/\\') . DIRECTORY_SEPARATOR : '';
    if ($path === false || !str_starts_with($path, $prefix) || !is_file($path)) {
        json_response(['success' => false, 'error' => 'Profile photo was not found'], 400);
    }

    return $url;
}

function fetch_updated_fields(mysqli $conn, int $userId): array
{
    $stmt = $conn->prepare('SELECT profile_photo, bio, instagram FROM user_accounts WHERE user_id = ? LIMIT 1');
    if (!$stmt) {
        throw new RuntimeException('Failed to load updated profile');
    }
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $result = $stmt->get_result();
    $row = $result ? $result->fetch_assoc() : null;
    $stmt->close();

    if (!$row) {
        return [];
    }

    return [
        'image_url' => format_profile_photo_url($row['profile_photo'] ?? null),
        'bio'       => $row['bio'] ?? '',
        'instagram' => $row['instagram'] ?? '',
    ];
}
