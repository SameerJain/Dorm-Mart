<?php
declare(strict_types=1);

require_once __DIR__ . '/../helpers/api_bootstrap.php';
require_once __DIR__ . '/../auth/auth_handle.php';
require_once __DIR__ . '/../helpers/image_upload.php';

init_json_endpoint('POST');

try {
    $userId = require_login();
    require_csrf_token($_POST['csrf_token'] ?? null);

    $file = extract_upload();
    if ($file === null) {
        json_response(['success' => false, 'error' => 'Image file is required'], 400);
    }

    $uploadError = $file['error'] ?? UPLOAD_ERR_NO_FILE;
    if ($uploadError !== UPLOAD_ERR_OK) {
        http_response_code(400);
        $errorMsg = 'Failed to upload profile photo';
        switch ($uploadError) {
            case UPLOAD_ERR_INI_SIZE:
            case UPLOAD_ERR_FORM_SIZE:
                $errorMsg = 'File is too large. Maximum file size is 10 MB.';
                break;
            case UPLOAD_ERR_PARTIAL:
                $errorMsg = 'File was only partially uploaded. Please try again.';
                break;
            case UPLOAD_ERR_NO_FILE:
                $errorMsg = 'No file was uploaded.';
                break;
            case UPLOAD_ERR_NO_TMP_DIR:
                $errorMsg = 'Server error: Missing temporary directory.';
                break;
            case UPLOAD_ERR_CANT_WRITE:
                $errorMsg = 'Server error: Failed to write file to disk.';
                break;
            case UPLOAD_ERR_EXTENSION:
                $errorMsg = 'File upload was stopped by a PHP extension.';
                break;
        }
        json_response(['success' => false, 'error' => $errorMsg], 400);
    }

    if (!is_uploaded_file($file['tmp_name'])) {
        json_response(['success' => false, 'error' => 'Invalid upload source'], 400);
    }

    $maxBytes  = 10 * 1024 * 1024; // 10 MB - reasonable limit for profile photos
    $allowed = [
        'image/jpeg' => 'jpg',
        'image/png'  => 'png',
        'image/webp' => 'webp',
        // Note: GIF removed to match frontend restrictions - profile photos don't need animation
    ];
    $imageInfo = uploaded_image_info($file, $maxBytes, $allowed);
    if (!$imageInfo['ok']) {
        $message = $imageInfo['error'] === 'image_too_large'
            ? 'Profile photo must be 10 MB or smaller'
            : 'Unsupported image format';
        json_response(['success' => false, 'error' => $message], $imageInfo['status']);
    }

    $apiRoot      = dirname(__DIR__);          // /api
    $projectRoot  = dirname($apiRoot);         // project root
    $envDir       = getenv('DATA_IMAGES_DIR');
    $envBase      = getenv('DATA_IMAGES_URL_BASE');
    $imageDirFs   = rtrim($envDir !== false && $envDir !== '' ? $envDir : ($projectRoot . '/images'), '/') . '/';
    $imageBaseUrl = rtrim($envBase !== false && $envBase !== '' ? $envBase : '/images', '/');

    if (!is_dir($imageDirFs) && !@mkdir($imageDirFs, 0775, true) && !is_dir($imageDirFs)) {
        throw new RuntimeException('Unable to create images directory');
    }

    $filename   = sprintf('profile_%d_%s.%s', $userId, bin2hex(random_bytes(8)), $imageInfo['extension']);
    $destPath   = $imageDirFs . $filename;
    $publicPath = $imageBaseUrl . '/' . $filename;

    // Process and compress image if GD is available
    $processed = process_profile_image($imageInfo['tmp_name'], $imageInfo['mime'], $destPath);
    if (!$processed) {
        // Fallback: if processing fails, just move the file
        if (!@move_uploaded_file($imageInfo['tmp_name'], $destPath)) {
            json_response(['success' => false, 'error' => 'Could not save uploaded photo'], 500);
        }
    }

    json_response([
        'success'   => true,
        'image_url' => $publicPath,
    ]);
} catch (Throwable $e) {
    error_log('upload_profile_photo.php error: ' . $e->getMessage());
    json_response(['success' => false, 'error' => 'Internal server error'], 500);
}

function extract_upload(): ?array
{
    $candidates = ['photo', 'avatar', 'image', 'file'];
    foreach ($candidates as $key) {
        if (!empty($_FILES[$key]) && is_array($_FILES[$key])) {
            return $_FILES[$key];
        }
    }
    if (!empty($_FILES)) {
        $file = reset($_FILES);
        if (is_array($file)) {
            return $file;
        }
    }
    return null;
}

/**
 * Process and compress profile image to reduce file size
 * Resizes to max 800x800px and compresses JPEG/PNG/WebP
 * Returns true if processing succeeded, false otherwise
 */
function process_profile_image(string $sourcePath, ?string $mime, string $destPath): bool
{
    // Check if GD extension is available
    if (!extension_loaded('gd')) {
        return false;
    }

    $maxWidth = 800;
    $maxHeight = 800;
    $quality = 85; // JPEG/WebP quality (0-100)

    // Load source image
    $sourceImage = null;
    switch ($mime) {
        case 'image/jpeg':
            $sourceImage = @imagecreatefromjpeg($sourcePath);
            break;
        case 'image/png':
            $sourceImage = @imagecreatefrompng($sourcePath);
            break;
        case 'image/webp':
            $sourceImage = @imagecreatefromwebp($sourcePath);
            break;
        default:
            return false;
    }

    if ($sourceImage === false) {
        return false;
    }

    // Get original dimensions
    $origWidth = imagesx($sourceImage);
    $origHeight = imagesy($sourceImage);

    // Calculate new dimensions (maintain aspect ratio)
    $ratio = min($maxWidth / $origWidth, $maxHeight / $origHeight);
    $newWidth = (int)($origWidth * $ratio);
    $newHeight = (int)($origHeight * $ratio);

    // Only resize if image is larger than max dimensions
    if ($origWidth <= $maxWidth && $origHeight <= $maxHeight) {
        $newWidth = $origWidth;
        $newHeight = $origHeight;
    }

    // Create new image
    $newImage = imagecreatetruecolor($newWidth, $newHeight);
    if ($newImage === false) {
        imagedestroy($sourceImage);
        return false;
    }

    // Preserve transparency for PNG
    if ($mime === 'image/png') {
        imagealphablending($newImage, false);
        imagesavealpha($newImage, true);
        $transparent = imagecolorallocatealpha($newImage, 255, 255, 255, 127);
        imagefilledrectangle($newImage, 0, 0, $newWidth, $newHeight, $transparent);
    }

    // Resize image
    if (!imagecopyresampled($newImage, $sourceImage, 0, 0, 0, 0, $newWidth, $newHeight, $origWidth, $origHeight)) {
        imagedestroy($sourceImage);
        imagedestroy($newImage);
        return false;
    }

    // Save processed image
    $saved = false;
    switch ($mime) {
        case 'image/jpeg':
            $saved = @imagejpeg($newImage, $destPath, $quality);
            break;
        case 'image/png':
            // PNG compression level 6 (0-9, where 9 is highest compression)
            $saved = @imagepng($newImage, $destPath, 6);
            break;
        case 'image/webp':
            $saved = @imagewebp($newImage, $destPath, $quality);
            break;
    }

    // Clean up
    imagedestroy($sourceImage);
    imagedestroy($newImage);

    return $saved !== false;
}
