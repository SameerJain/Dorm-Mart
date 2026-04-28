<?php

declare(strict_types=1);
require_once __DIR__ . '/../helpers/api_bootstrap.php';
require_once __DIR__ . '/../auth/auth_handle.php';
require_once __DIR__ . '/../helpers/image_upload.php';
require __DIR__ . '/../database/db_connect.php';

init_json_endpoint();

auth_boot_session();

// Require a logged-in user
$userId = require_login();

// This endpoint expects multipart/form-data with an image file
require_multipart_formdata();

// Validate presence of the uploaded image
if (!isset($_FILES['image']) || $_FILES['image']['error'] !== UPLOAD_ERR_OK) {
    json_response(['success' => false, 'error' => 'missing_image'], 400);
}

// Validate file size (2MB max per image)
$MAX_BYTES = 2 * 1024 * 1024;
$allowed = [
    'image/jpeg' => 'jpg',
    'image/png'  => 'png',
    'image/webp' => 'webp',
];
$imageInfo = uploaded_image_info($_FILES['image'], $MAX_BYTES, $allowed);
if (!$imageInfo['ok']) {
    $payload = ['success' => false, 'error' => $imageInfo['error']];
    if (isset($imageInfo['max_bytes'])) {
        $payload['max_bytes'] = $imageInfo['max_bytes'];
    }
    json_response($payload, $imageInfo['status']);
}
$ext = $imageInfo['extension'];

// Build destination directory
$projectRoot = dirname(__DIR__, 2);
$destDir     = $projectRoot . '/media/review-images';
if (!is_dir($destDir)) {
    if (!ensure_upload_directory($destDir)) {
        json_response(['success' => false, 'error' => 'media_dir_unwritable'], 500);
    }
}

// Generate a unique filename to avoid collisions
$fname = sprintf(
    'review_u%s_%s_%s.%s',
    $userId,
    gmdate('Ymd_His'),
    bin2hex(random_bytes(6)),  // random suffix
    $ext
);
$destPath = $destDir . '/' . $fname;

// Move the uploaded temp file to the destination
if (!@move_uploaded_file($imageInfo['tmp_name'], $destPath)) {
    json_response(['success' => false, 'error' => 'image_save_failed'], 500);
}

// Build the public relative URL path that the frontend can use
$imageRelUrl = '/media/review-images/' . $fname;

json_response([
    'success'   => true,
    'image_url' => $imageRelUrl,
], 200, JSON_UNESCAPED_SLASHES);
