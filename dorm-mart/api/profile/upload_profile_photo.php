<?php
declare(strict_types=1);

require_once __DIR__ . '/../security/security.php';
require_once __DIR__ . '/../auth/auth_handle.php';

setSecurityHeaders();
setSecureCORS();

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method Not Allowed']);
    exit;
}

try {
    $userId = require_login();

    $file = extract_upload();
    if ($file === null) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Image file is required']);
        exit;
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
        echo json_encode(['success' => false, 'error' => $errorMsg]);
        exit;
    }

    if (!is_uploaded_file($file['tmp_name'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid upload source']);
        exit;
    }

    $sizeBytes = filesize($file['tmp_name']);
    $maxBytes  = 10 * 1024 * 1024; // 10 MB - reasonable limit for profile photos
    if ($sizeBytes === false) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Unable to determine file size']);
        exit;
    }
    if ($sizeBytes > $maxBytes) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Profile photo must be 10 MB or smaller']);
        exit;
    }

    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mime  = $finfo ? finfo_file($finfo, $file['tmp_name']) : null;
    if ($finfo) {
        finfo_close($finfo);
    }

    $allowed = [
        'image/jpeg' => 'jpg',
        'image/png'  => 'png',
        'image/webp' => 'webp',
        // Note: GIF removed to match frontend restrictions - profile photos don't need animation
    ];
    if (!isset($allowed[$mime ?? ''])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Unsupported image format']);
        exit;
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

    $filename   = sprintf('profile_%d_%s.%s', $userId, bin2hex(random_bytes(8)), $allowed[$mime]);
    $destPath   = $imageDirFs . $filename;
    $publicPath = $imageBaseUrl . '/' . $filename;

    // Process and compress image if GD is available
    $processed = processProfileImage($file['tmp_name'], $mime, $destPath);
    if (!$processed) {
        // Fallback: if processing fails, just move the file
        if (!@move_uploaded_file($file['tmp_name'], $destPath)) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Could not save uploaded photo']);
            exit;
        }
    }

    echo json_encode([
        'success'   => true,
        'image_url' => $publicPath,
    ]);
} catch (Throwable $e) {
    error_log('upload_profile_photo.php error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Internal server error']);
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
function processProfileImage(string $sourcePath, ?string $mime, string $destPath): bool
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
